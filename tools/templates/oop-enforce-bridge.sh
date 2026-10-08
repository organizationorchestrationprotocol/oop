#!/bin/sh
# Conditional POSIX-shell template version 1; source identity @@SOURCE_IDENTITY@@.
# Requires: an eligible POSIX shell, jq 1.7+, a compatible timeout utility with
# -k/seconds semantics, iconv, mktemp -d, and standard byte-preserving utilities.
# These are conditional host dependencies, not universal OOP requirements.
# The trusted native boundary authenticates observations and confines real effects.
# This transport alone provides neither property. Never treat stdin as authority.
set -eu
[ "$#" -eq 4 ] || exit 4
controller=$1 interpreter=$2 command=$3 expected_source=$4
case "$controller:$interpreter" in /*:/*) ;; *) exit 4;; esac
case "$command" in entry|interaction|pre-effect|post-effect|completion|recovery|delegate|probe|validate-configuration) ;; *) exit 4;; esac
for utility in jq timeout mktemp sed wc cat rm iconv; do command -v "$utility" >/dev/null 2>&1 || exit 4; done
umask 077
work=$(mktemp -d) || exit 4
trap 'rm -f "$work/input" "$work/request" "$work/output" "$work/error"; rmdir "$work"' 0
trap 'exit 4' HUP INT TERM
# HOST-EVENT ADAPTATION: explicitly configured OOP envelopes only. Replace this
# function with documented event mapping in this shell for another host format;
# preserve the transport and correlated response checks below.
adapt_event() {
  [ "${OOP_EVENT_FORMAT:-}" = oop-request-v1 ] || return 1
  cat
}
adapt_event >"$work/input" || exit 4
[ "$(wc -c <"$work/input")" -le 1048576 ] || exit 4
LC_ALL=C sed "1s/^$(printf '\357\273\277')//" "$work/input" >"$work/request"
iconv -f UTF-8 -t UTF-8 <"$work/request" >/dev/null || exit 4
jq -e -s 'length==1 and (.[0]|type=="object")' <"$work/request" >/dev/null || exit 4
jq -e '.request_id|type=="string" and length>0 and length<=512' <"$work/request" >/dev/null || exit 4
code=0
timeout -k 1 "${OOP_TIMEOUT_SECONDS:-6}" "$interpreter" "$controller" "$command" <"$work/request" >"$work/output" 2>"$work/error" || code=$?
case "$code" in 0|2|3|4) ;; *) exit 4;; esac
[ "$(wc -c <"$work/output")" -le 2097152 ] || exit 4
iconv -f UTF-8 -t UTF-8 <"$work/output" >/dev/null || exit 4
jq -e -s 'length==1 and (.[0]|type=="object")' <"$work/output" >/dev/null || exit 4
if [ "$command" = validate-configuration ]; then
  cat "$work/request" "$work/output" | jq -e -s --arg source "$expected_source" --argjson code "$code" '
    .[0] as $request | $request.request_id as $id | .[1] |
    (keys==(["format","type","request_id","source_binding","valid","reason","dispatch_verified","validation_binding","error"]|sort)) and
    .format==1 and .type=="oop_configuration_validation" and .request_id==$id and
    .source_binding=={kind:"source_content",source_identity:$source} and
    (.valid|type=="boolean") and (.error|type=="boolean") and .dispatch_verified==false and
    (.reason|type=="string" and length>0) and ((.error and .valid)|not) and
    (if .error then $code==4 elif .valid then $code==0 and (.validation_binding|type=="object") else $code==2 end) and
    (if .valid then
      (.validation_binding|keys==(["plan_identity","observation_identity","configuration_revision","host","installation_uid","workspace","observation_reference"]|sort)) and
      (.validation_binding.plan_identity|test("^sha256:[a-f0-9]{64}$")) and (.validation_binding.observation_identity|test("^sha256:[a-f0-9]{64}$")) and
      .validation_binding.configuration_revision==$request.plan.expected_revision and .validation_binding.configuration_revision==$request.facts.configuration_revision and
      .validation_binding.host==$request.facts.host and .validation_binding.installation_uid==$request.facts.installation_uid and
      .validation_binding.workspace==$request.facts.workspace and .validation_binding.observation_reference==$request.facts.reference
    else .validation_binding==null end)
  ' >/dev/null || exit 4
else
  cat "$work/request" "$work/output" | jq -e -s --arg command "$command" --arg source "$expected_source" --argjson code "$code" '
    .[0] as $request | $request.request_id as $id | .[1] |
    (keys==(["format","type","request_id","command","source_binding","decision","reason_code","effect_permission","assurance","payload"]|sort)) and
    .format==1 and .type=="oop_admission" and .request_id==$id and .command==$command and
    .source_binding=={kind:"source_content",source_identity:$source} and
    (.reason_code|type=="string" and length>0) and (.assurance|type=="string" and length>0) and (.payload|type=="object") and
    ({allow:0,deny:2,unknown:3,error:4}[.decision]==$code) and
    (if .command=="pre-effect" and .decision=="allow" then .effect_permission=="conditional_on_adapter" else .effect_permission=="not_granted" end) and
    (if .decision=="allow" then
      (.payload|keys==(["checked","modules","observation_time","semantic_assurance","state_write"]|sort)) and
      (.payload.checked|type=="array" and length>0 and all(.[];type=="string" and length>0)) and
      (.payload.modules|type=="array" and length>0 and all(.[];type=="string" and length>0)) and
      (.payload.observation_time|type=="string" and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T")) and
      (.payload.semantic_assurance|type=="string" and length>0) and (.payload.state_write|type=="string" and length>0)
    else true end)
  ' >/dev/null || exit 4
fi
cat "$work/output"
exit "$code"
