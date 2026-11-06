"""Local signer for synthetic fixtures ONLY. No networking and no real-key input."""
import argparse
import hashlib
import hmac
import json
from pathlib import Path
import time

DUMMY_KEY = b"documentation-fixture-key-not-for-production"


def sign(raw, timestamp):
    return hmac.new(DUMMY_KEY, str(timestamp).encode("ascii") + b"." + raw, hashlib.sha256).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("body", type=Path)
    parser.add_argument("--timestamp", type=int, default=int(time.time()))
    args = parser.parse_args()
    print(json.dumps({"x-event-timestamp": str(args.timestamp),
                      "x-event-signature": sign(args.body.read_bytes(), args.timestamp)}))


if __name__ == "__main__":
    main()
