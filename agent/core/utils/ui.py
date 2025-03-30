import tkinter as tk
from tkinter import messagebox
from tkinter import ttk
import sys


class SetupDialog:
    def __init__(self, initial_values=None):
        self.result = None

        root = tk.Tk()
        root.title("Agent Setup")
        root.geometry("400x200")  # Made wider to accommodate longer URLs

        frame = ttk.Frame(root, padding="10")
        frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        ttk.Label(frame, text="Server Link:").grid(row=0, column=0, sticky=tk.W)
        ttk.Label(frame, text="Room Name:").grid(row=1, column=0, sticky=tk.W)
        ttk.Label(frame, text="Row Index:").grid(row=2, column=0, sticky=tk.W)
        ttk.Label(frame, text="Column Index:").grid(row=3, column=0, sticky=tk.W)

        self.server_link = ttk.Entry(frame, width=30)  # Made wider for URLs
        self.room_name = ttk.Entry(frame)
        self.row_index = ttk.Entry(frame)
        self.column_index = ttk.Entry(frame)

        self.server_link.grid(row=0, column=1, padx=5, pady=5)
        self.room_name.grid(row=1, column=1, padx=5, pady=5)
        self.row_index.grid(row=2, column=1, padx=5, pady=5)
        self.column_index.grid(row=3, column=1, padx=5, pady=5)

        # Điền các giá trị ban đầu nếu có
        if initial_values:
            self.server_link.insert(0, initial_values.get("server_link", "http://localhost:3000"))
            self.room_name.insert(0, initial_values.get("room_name", ""))
            self.row_index.insert(0, str(initial_values.get("row_index", "")))
            self.column_index.insert(0, str(initial_values.get("column_index", "")))
        else:
            self.server_link.insert(0, "http://localhost:3000")

        ttk.Button(frame, text="OK", command=self.on_submit).grid(
            row=4, column=0, columnspan=2, pady=20
        )

        root.protocol("WM_DELETE_WINDOW", lambda: sys.exit(1))
        self.root = root

    def validate_server_link(self, link):
        """Validate that the server link is a proper URL format"""
        return link.startswith(("http://", "https://"))

    def on_submit(self):
        try:
            server_link = self.server_link.get().strip()
            room_name = self.room_name.get().strip()
            row_index = int(self.row_index.get())
            column_index = int(self.column_index.get())

            if not self.validate_server_link(server_link):
                messagebox.showerror("Error", "Server link must start with http:// or https://")
                return

            if not room_name:
                messagebox.showerror("Error", "Room name is required")
                return

            if row_index < 1 or column_index < 1:
                messagebox.showerror(
                    "Error", "Row and Column index must be greater than 0"
                )
                return

            self.result = {
                "server_link": server_link,
                "room_name": room_name,
                "row_index": row_index,
                "column_index": column_index,
            }
            self.root.destroy()
        except ValueError:
            messagebox.showerror("Error", "Row and Column index must be numbers")

    def get_result(self):
        self.root.mainloop()
        return self.result
    

def show_error(title, message):
    messagebox.showerror(title, message)