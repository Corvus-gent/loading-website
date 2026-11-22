import importlib.util
import json
import unittest
import sys
sys.dont_write_bytecode = True
from pathlib import Path

spec = importlib.util.spec_from_file_location("usage", Path(__file__).parent.parent / "tools/migration-report/usage.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def message(text,stamp):
    return {"timestamp":stamp,"type":"response_item","payload":{"role":"user","content":[{"text":text}]}}

def usage(identity="one",**changes):
    tokens={"input_tokens":100,"cached_input_tokens":80,"output_tokens":10,"reasoning_output_tokens":4,"total_tokens":110}
    tokens.update(changes)
    return {"timestamp":"2026-11-21T01:00:00Z","type":"token_usage_record","payload":{"response_id":identity,"usage":tokens,"thread_id":"private"}}

class UsageTests(unittest.TestCase):
    def collect(self,records):
        return mod.aggregate(map(json.dumps,records))
    def test_scoped_deduplicated_and_sanitized(self):
        records=[usage("old"),message(mod.START,"2026-11-20T00:00:00Z"),usage(),usage(),{"type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"total_tokens":999999}}}},message(mod.END,"2026-11-21T02:00:00Z"),usage("article")]
        got=self.collect(records)
        self.assertEqual(got["tokens"]["total_tokens"],110)
        self.assertEqual(got["responses"],1)
        self.assertEqual(got["duplicates_skipped"],1)
        self.assertEqual(got["uncached_input_tokens"],20)
        self.assertIsNone(got["credits"])
        self.assertNotIn("private",json.dumps(got))
    def test_missing_marker(self):
        with self.assertRaises(ValueError):self.collect([usage()])
    def test_unclosed_window_is_not_publishable_migration_usage(self):
        with self.assertRaisesRegex(ValueError, "end marker"):
            self.collect([message(mod.START,"2026-11-20T00:00:00Z"),usage(),usage("later-work")])
    def test_invalid_or_conflicting_counts(self):
        for entry in [usage(input_tokens=-1),usage(cached_input_tokens=101),usage(reasoning_output_tokens=11),usage(total_tokens=999)]:
            with self.assertRaises(ValueError):self.collect([message(mod.START,"2026-11-20T00:00:00Z"),entry])
        with self.assertRaises(ValueError):self.collect([message(mod.START,"2026-11-20T00:00:00Z"),usage(),usage(output_tokens=11,total_tokens=111)])

if __name__=="__main__":unittest.main()
