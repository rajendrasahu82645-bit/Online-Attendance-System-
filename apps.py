frome flask import flask
import os

app =flask(__name__)

@app.route("/")
def home():
    return "server running successfully"

if __name__== "__main__":
    port =int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0",port=port)
