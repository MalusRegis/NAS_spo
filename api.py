#api mit allen funktionen, die der frontend client benötigt. Zugriff nur mit token möglich.
import os
import hmac
from flask import Flask, request, jsonify, send_from_directory, abort

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024**3  # 2 GB upload limit

BASE_DIR = os.path.realpath("/mnt/raid5")
API_TOKEN = os.environ["SPODE_API_TOKEN"]  # set this in the environment

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
DOC_EXTS = {".pdf", ".docx", ".doc", ".txt"}


AUTH_ENABLED = os.environ.get("SPODE_AUTH", "1") == "1"

@app.route("/")
def index():
    return send_from_directory(os.path.dirname(os.path.abspath(__file__)), "index.html")

@app.before_request
def require_token():
    if not AUTH_ENABLED:
        return
    supplied = request.headers.get("Authorization", "")
    if not hmac.compare_digest(supplied, f"Bearer {API_TOKEN}"):
        abort(401)

def resolve(subpath):
    """Return the real absolute path, or None if it escapes BASE_DIR."""
    try:
        target = os.path.realpath(os.path.join(BASE_DIR, subpath))
        if os.path.commonpath([BASE_DIR, target]) != BASE_DIR:
            return None
    except ValueError:  # null bytes, etc.
        return None
    return target


def get_file_type(filename):
    ext = os.path.splitext(filename)[1].lower()
    if ext in IMAGE_EXTS:
        return "image"
    if ext in DOC_EXTS:
        return "document"
    return "other"


@app.route("/browse", defaults={"subpath": ""}, methods=["GET"])
@app.route("/browse/<path:subpath>", methods=["GET"])
def browse_directory(subpath):
    target = resolve(subpath)
    if target is None:
        return jsonify({"error": "Access denied"}), 403
    if not os.path.exists(target):
        return jsonify({"error": "Path not found"}), 404

    if os.path.isfile(target):
        return jsonify({
            "relative_path": subpath,
            "is_file": True,
            "file_type": get_file_type(target),
        })

    folders, files = [], []
    try:
        names = sorted(os.listdir(target))
    except PermissionError:
        return jsonify({"error": "Permission denied"}), 403

    for name in names:
        full = os.path.join(target, name)
        rel = os.path.relpath(full, BASE_DIR)
        if os.path.isdir(full):
            folders.append({"name": name, "rel_path": rel, "is_dir": True})
        elif os.path.isfile(full):
            files.append({
                "name": name, "rel_path": rel, "is_dir": False,
                "file_type": get_file_type(name),
                "extension": os.path.splitext(name)[1].lower(),
            })

    return jsonify({"relative_path": subpath, "folders": folders, "files": files})


@app.route("/upload/<path:subpath>", methods=["POST"])
def upload_file(subpath):
    target = resolve(subpath)
    if target is None:
        return jsonify({"error": "Access denied"}), 403
    if not os.path.isdir(os.path.dirname(target)):
        return jsonify({"error": "Parent directory not found"}), 404
    if os.path.isdir(target):
        return jsonify({"error": "Target is a directory"}), 400
    if os.path.exists(target) and request.args.get("overwrite") != "true":
        return jsonify({"error": "File exists (use ?overwrite=true)"}), 409

    file = request.files.get("file")
    if file is None or file.filename == "":
        return jsonify({"error": "No file provided"}), 400

    tmp = target + ".part"
    file.save(tmp)
    os.replace(tmp, target)  # atomic
    return jsonify({"message": "File uploaded", "relative_path": subpath}), 201


@app.route("/new_folder/<path:subpath>", methods=["POST"])
def new_folder(subpath):
    target = resolve(subpath)
    if target is None:
        return jsonify({"error": "Access denied"}), 403
    if not os.path.isdir(os.path.dirname(target)):
        return jsonify({"error": "Parent directory not found"}), 404
    try:
        os.mkdir(target)
    except FileExistsError:
        return jsonify({"error": "Already exists"}), 409
    return jsonify({"message": "Folder created", "relative_path": subpath}), 201


@app.route("/delete/<path:subpath>", methods=["DELETE"])
def delete_item(subpath):
    target = resolve(subpath)
    if target is None or target == BASE_DIR:
        return jsonify({"error": "Access denied"}), 403
    if not os.path.exists(target):
        return jsonify({"error": "Path not found"}), 404
    try:
        if os.path.isdir(target):
            os.rmdir(target)
        else:
            os.remove(target)
    except OSError as e:
        app.logger.error("Delete failed for %s: %s", target, e)
        return jsonify({"error": "Could not delete (folder not empty?)"}), 409
    return jsonify({"message": "Deleted", "relative_path": subpath}), 200


@app.route("/download/<path:subpath>", methods=["GET"])
def download_file(subpath):
    target = resolve(subpath)
    if target is None:
        return jsonify({"error": "Access denied"}), 403
    if not os.path.isfile(target):
        return jsonify({"error": "File not found"}), 404
    return send_from_directory(
        BASE_DIR, os.path.relpath(target, BASE_DIR), as_attachment=True
    )


if __name__ == "__main__":
    # Dev only. In production: gunicorn -w 2 -b 0.0.0.0:5000 app:app
    app.run(host="0.0.0.0", port=5000, debug=False)