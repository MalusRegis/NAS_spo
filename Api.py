#Api mit der alle datein und Info über de NAS laufen
import os
from flask import Flask, request, jsonify

app = Flask(__name__)

BasePath = '/mnt/raid5/'

#zeigt alle datein in raid5 and gibt sie als json zurück 
@app.route('/list', methods=['GET'])
def list_files():
    try:
        files = os.listdir(BasePath)
        return jsonify(files)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/read-file/<filename>', methods=['GET'])
def read_file(filename):
    # Securely build Linux file path
    file_path = os.path.abspath(os.path.join(BasePath, filename))
    
    # Prevent directory traversal attacks
    if not file_path.startswith(os.path.abspath(BasePath)):
        return jsonify({"error": "Access denied"}), 403

    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    return jsonify({"filename": filename, "content": content}), file_path
