"""Aggregate local usage records; never export prompts, IDs, paths or account data."""
import argparse
import json
from collections import Counter
from pathlib import Path

START = "herschrijf de hele corvus.gent stack naar rust"
END = "ik wil eigenlijk dat jij een stand bijhoudt"


def aggregate(lines, start_marker=START, end_marker=END):
    start = end = last = None
    seen = {}
    totals = Counter()
    models = set()
    model = None
    duplicates = 0
    for line in lines:
        record = json.loads(line)
        payload = record.get("payload", {})
        if record.get("type") == "turn_context":
            model = payload.get("model")
        if record.get("type") == "response_item" and payload.get("role") == "user":
            text = " ".join(c.get("text", "") for c in payload.get("content", []) if isinstance(c, dict)).lower()
            if start is None and start_marker in text:
                start = record["timestamp"]
            if start and end_marker in text:
                end = record["timestamp"]
                break
        if not start or record.get("type") != "token_usage_record":
            continue
        identity = payload.get("response_id")
        if not identity:
            raise ValueError("Usage record has no deduplication key")
        if identity in seen:
            if seen[identity] != payload["usage"]:
                raise ValueError("Conflicting duplicate usage record")
            duplicates += 1
            continue
        usage = payload["usage"]
        keys = ("input_tokens", "cached_input_tokens", "output_tokens", "reasoning_output_tokens", "total_tokens")
        if any(type(usage.get(k)) is not int or usage[k] < 0 for k in keys):
            raise ValueError("Missing or negative usage counter")
        if usage["cached_input_tokens"] > usage["input_tokens"] or usage["reasoning_output_tokens"] > usage["output_tokens"]:
            raise ValueError("Invalid subset counters")
        if usage["total_tokens"] != usage["input_tokens"] + usage["output_tokens"]:
            raise ValueError("Token totals do not reconcile")
        seen[identity] = usage
        totals.update({k: usage[k] for k in keys})
        last = record["timestamp"]
        if model:
            models.add(model)
    if not start or not seen:
        raise ValueError("No migration window or usage records found")
    if not end:
        raise ValueError("Migration end marker is missing; do not attribute later unrelated work")
    return {
        "status": "observed-local", "started": start, "through": last,
        "window_closed_at": end, "responses": len(seen), "duplicates_skipped": duplicates,
        "models": sorted(models), "tokens": dict(totals),
        "uncached_input_tokens": totals["input_tokens"] - totals["cached_input_tokens"],
        "credits": None, "usd": None, "billing_evidence": None,
        "method": "Unique per-response token_usage_record entries in the root chat, from the explicit Rust request to the report request. Cumulative/event copies are excluded. Cached input is a subset of input; reasoning is a subset of output, never added twice.",
        "limitations": ["Local root-chat telemetry, not an invoice or guaranteed complete account usage.", "Model metadata is recorded; billing service tier and plan allocation are unavailable.", "Earlier site/video tasks and this article-page build are excluded. Child-chat/provider usage, if any, is not included.", "Repeated context counts again as input; most was cached. These are not unique words or source-code lines."]
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("log")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    with Path(args.log).open() as lines:
        result = aggregate(lines)
    Path(args.out).write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"responses": result["responses"], "tokens": result["tokens"], "billing": "unverified"}))
