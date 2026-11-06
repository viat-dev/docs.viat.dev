"""Local function assertions only; no Viat API or external provider is called."""
import contextlib
import importlib.util
import io
from pathlib import Path

source = Path(__file__).with_name("hello.py")
spec = importlib.util.spec_from_file_location("handbook_hello", source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

for args, expected in [
    ({}, {"message": "Hello, world!"}),
    ({"name": "Ada"}, {"message": "Hello, Ada!"}),
    ({"name": 'Ada "Lovelace"'}, {"message": 'Hello, Ada "Lovelace"!'}),
]:
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        actual = module.main(**args)
    assert actual == expected, (actual, expected)
    assert output.getvalue() == "hello endpoint invoked\n"
print("hello-endpoint: 3 local function assertions passed; server integration not exercised")
