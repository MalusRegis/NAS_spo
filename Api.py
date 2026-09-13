#Api mit der alle datein und Info über de NAS laufen
import os
from flask import Flask, request, jsonify

app = Flask(__name__)

DataPath = '/mnt/raid5/'

@app.route('/list', methods=['GET'])
def list_files():
    try:
        files = os.listdir(DataPath)
        return jsonify(files)
    except Exception as e:
        return jsonify({'error': str(e)}), 500