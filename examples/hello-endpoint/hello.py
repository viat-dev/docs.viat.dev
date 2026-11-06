def main(name: str = "world") -> dict:
    print("hello endpoint invoked")
    return {"message": f"Hello, {name}!"}
