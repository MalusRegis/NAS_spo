#Api mit der alle datein und Info über de NAS laufen
import os
from flask import Flask, request, jsonify

app = Flask(__name__)

BASE_DIR = '/mnt/raid5/'

# datentypen kategorisieren um bilder und datein zu unterscheiden
IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
DOC_EXTS = {'.pdf', '.docx', '.doc', '.txt'}

#schaut ob der Pfad innerhalb des Basisverzeichnisses liegt, um unbefugten Zugriff zu verhindern
def is_safe_path(base_dir, path):
    abs_base = os.path.abspath(base_dir)
    abs_target = os.path.abspath(path)
    return abs_target.startswith(abs_base)

#klassiefiziert  die dateitypen anhand der Dateiendung
def get_file_type(filename):
    ext = os.path.splitext(filename)[1].lower()
    if ext in IMAGE_EXTS:
        return 'image'
    elif ext in DOC_EXTS:
        return 'document'
    return 'other'

@app.route('/browse', defaults={'subpath': ''}, methods=['GET'])
@app.route('/browse/<path:subpath>', methods=['GET'])
def browse_directory(subpath):
    data_path = os.path.abspath(os.path.join(BASE_DIR, subpath))

    # Security check to ensure subpath stays inside BASE_DIR
    if not is_safe_path(BASE_DIR, data_path):
        return jsonify({"error": "Access denied"}), 403

    if not os.path.exists(data_path):
        return jsonify({"error": "Path not found"}), 404

    # If DataPath is a directory, list all contained folders and files
    if os.path.isdir(data_path):
        folders = []
        files = []

<<<<<<< HEAD
        for name in sorted(os.listdir(data_path)):
            full_item_path = os.path.join(data_path, name)
            rel_item_path = os.path.relpath(full_item_path, BASE_DIR)

            if os.path.isdir(full_item_path):
                folders.append({
                    "name": name,
                    "rel_path": rel_item_path,
                    "is_dir": True
                })
            elif os.path.isfile(full_item_path):
                files.append({
                    "name": name,
                    "rel_path": rel_item_path,
                    "is_dir": False,
                    "file_type": get_file_type(name),
                    "extension": os.path.splitext(name)[1].lower()
                })

        return jsonify({
            "DataPath": data_path,
            "relative_path": subpath,
            "folders": folders,
            "files": files
        })

    # If DataPath points directly to a file
    return jsonify({
        "DataPath": data_path,
        "is_file": True,
        "file_type": get_file_type(os.path.basename(data_path))
    })
=======
    return jsonify({"filename": filename, "content": content}), file_path

>>>>>>> 2ae917f88ef42548af60c4cc901eeabfb668c0b3

if  __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)