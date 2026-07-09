# converter_gui.py
"""Simple GUI to convert a Firebird .fdb file to a JSON export.

Requirements (pip):
  - fdb          # Firebird driver
  - pyqt5        # GUI library (you can also use Tkinter or PySimpleGUI)
  - pyinstaller  # to build an .exe (optional, for packaging)

Usage (source):
  python converter_gui.py

Packaging (to .exe):
  pyinstaller --onefile --windowed converter_gui.py

The resulting executable will open a window where the user selects an *.fdb* file
and chooses a destination folder. The program reads all tables, their metadata
and rows, and writes a single JSON file named "conversion.json".
"""

import sys
import json
import os
from pathlib import Path

# PyQt5 imports (fallback to PySide2 if needed)
try:
    from PyQt5 import QtWidgets, QtCore
except ImportError:
    from PySide2 import QtWidgets, QtCore

# Firebird driver
import fdb

class FirebirdToJsonConverter(QtWidgets.QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Firebird .fdb → conversion.json")
        self.setMinimumSize(500, 200)
        self.layout = QtWidgets.QVBoxLayout(self)
        self._build_ui()

    def _build_ui(self):
        # File selector for .fdb
        file_layout = QtWidgets.QHBoxLayout()
        self.file_edit = QtWidgets.QLineEdit()
        self.file_edit.setPlaceholderText("Select .fdb file …")
        browse_btn = QtWidgets.QPushButton("Browse")
        browse_btn.clicked.connect(self.browse_fdb)
        file_layout.addWidget(self.file_edit)
        file_layout.addWidget(browse_btn)
        self.layout.addLayout(file_layout)

        # Destination folder selector
        dest_layout = QtWidgets.QHBoxLayout()
        self.dest_edit = QtWidgets.QLineEdit()
        self.dest_edit.setPlaceholderText("Select destination folder …")
        dest_btn = QtWidgets.QPushButton("Folder")
        dest_btn.clicked.connect(self.browse_folder)
        dest_layout.addWidget(self.dest_edit)
        dest_layout.addWidget(dest_btn)
        self.layout.addLayout(dest_layout)

        # Convert button & progress bar
        self.convert_btn = QtWidgets.QPushButton("Convert to JSON")
        self.convert_btn.clicked.connect(self.convert)
        self.progress = QtWidgets.QProgressBar()
        self.progress.setVisible(False)
        self.layout.addWidget(self.convert_btn)
        self.layout.addWidget(self.progress)

        # Status label
        self.status = QtWidgets.QLabel("")
        self.layout.addWidget(self.status)

    def browse_fdb(self):
        fname, _ = QtWidgets.QFileDialog.getOpenFileName(self, "Select .fdb file", "", "Firebird DB (*.fdb);;All Files (*)")
        if fname:
            self.file_edit.setText(fname)

    def browse_folder(self):
        folder = QtWidgets.QFileDialog.getExistingDirectory(self, "Select destination folder")
        if folder:
            self.dest_edit.setText(folder)

    def convert(self):
        fdb_path = self.file_edit.text().strip()
        dest_folder = self.dest_edit.text().strip()
        if not fdb_path or not dest_folder:
            QtWidgets.QMessageBox.warning(self, "Missing data", "Please select both the .fdb file and a destination folder.")
            return
        if not Path(fdb_path).exists():
            QtWidgets.QMessageBox.critical(self, "File not found", f"The file {fdb_path} does not exist.")
            return

        self.convert_btn.setEnabled(False)
        self.progress.setVisible(True)
        self.progress.setRange(0, 0)  # indefinite while processing
        QtWidgets.QApplication.processEvents()

        try:
            # macOS sandbox workaround: copy .fdb to /tmp to avoid permission errors
            import shutil
            tmp_fdb = Path("/tmp") / Path(fdb_path).name
            shutil.copy2(fdb_path, tmp_fdb)
            self.status.setText("Copiando base de datos a ubicación temporal...")
            QtWidgets.QApplication.processEvents()

            data = self._export_fdb_to_json(str(tmp_fdb))
            output_path = Path(dest_folder) / "conversion.json"
            with open(output_path, "w", encoding="utf-8") as fp:
                json.dump(data, fp, ensure_ascii=False, indent=2)
            self.status.setText(f"✅ Conversion completed: {output_path}")

            # Cleanup temp file
            try:
                tmp_fdb.unlink()
            except Exception:
                pass
        except Exception as e:
            QtWidgets.QMessageBox.critical(self, "Error", str(e))
            self.status.setText("❌ Conversion failed.")
        finally:
            self.progress.setVisible(False)
            self.convert_btn.setEnabled(True)

    def _export_fdb_to_json(self, fdb_path):
        """Connects to the .fdb, reads all tables and returns a dict.
        The structure is:
        {
            "tables": {
                "table_name": {
                    "columns": ["col1", "col2", ...],
                    "rows": [ {"col1": value, "col2": value, ...}, ... ]
                },
                ...
            }
        }
        """
        # Firebird connection: using embedded client (no server needed)
        conn = fdb.connect(dsn=fdb_path, user="sysdba", password="masterkey", charset="UTF8")
        cur = conn.cursor()
        # Get list of user tables (exclude system tables that start with RDB$)
        cur.execute("SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0")
        tables = [row[0].strip() for row in cur.fetchall()]
        result = {"tables": {}}
        for tbl in tables:
            # columns
            cur.execute(
                "SELECT RDB$FIELD_NAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = ? ORDER BY RDB$FIELD_POSITION",
                (tbl,)
            )
            columns = [c[0].strip() for c in cur.fetchall()]
            # fetch rows
            cur.execute(f"SELECT * FROM \"{tbl}\"")
            rows = []
            for row in cur.fetchall():
                # Convert each value to a JSON‑serializable form
                row_dict = {}
                for col, val in zip(columns, row):
                    if isinstance(val, bytes):
                        row_dict[col] = val.hex()
                    elif isinstance(val, (int, float, str, type(None))):
                        row_dict[col] = val
                    else:
                        # fallback to string representation
                        row_dict[col] = str(val)
                rows.append(row_dict)
            result["tables"][tbl] = {"columns": columns, "rows": rows}
        cur.close()
        conn.close()
        return result

def main():
    app = QtWidgets.QApplication(sys.argv)
    win = FirebirdToJsonConverter()
    win.show()
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()
