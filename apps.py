frome flask import flask

app =flask(__name__)

@app.route("/")
def home():
    return "server running successfully"

if __name__== "__main__":
    app.run()
