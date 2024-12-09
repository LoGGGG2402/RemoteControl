import tkinter as tk
from tkinter import messagebox
from tkinter import ttk
import sys

class SetupDialog:
    def __init__(self):
        self.result = None
        
        root = tk.Tk()
        root.title("Agent Setup")
        root.geometry("300x200")
        
        frame = ttk.Frame(root, padding="10")
        frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        ttk.Label(frame, text="Server IP:").grid(row=0, column=0, sticky=tk.W)
        ttk.Label(frame, text="Room ID:").grid(row=1, column=0, sticky=tk.W)
        ttk.Label(frame, text="Row Index:").grid(row=2, column=0, sticky=tk.W)
        ttk.Label(frame, text="Column Index:").grid(row=3, column=0, sticky=tk.W)
        
        self.server_ip = ttk.Entry(frame)
        self.room_id = ttk.Entry(frame)
        self.row_index = ttk.Entry(frame)
        self.column_index = ttk.Entry(frame)
        
        self.server_ip.grid(row=0, column=1, padx=5, pady=5)
        self.room_id.grid(row=1, column=1, padx=5, pady=5)
        self.row_index.grid(row=2, column=1, padx=5, pady=5)
        self.column_index.grid(row=3, column=1, padx=5, pady=5)
        
        self.server_ip.insert(0, "localhost")  # Default value
        
        ttk.Button(frame, text="OK", command=self.on_submit).grid(row=4, column=0, columnspan=2, pady=20)
        
        root.protocol("WM_DELETE_WINDOW", lambda: sys.exit(1))
        self.root = root

    def on_submit(self):
        try:
            self.result = {
                "server_ip": self.server_ip.get(),
                "room_id": int(self.room_id.get()),
                "row_index": int(self.row_index.get()),
                "column_index": int(self.column_index.get())
            }
            self.root.destroy()
        except ValueError:
            messagebox.showerror("Error", "Please enter valid numbers")

    def get_result(self):
        self.root.mainloop()
        return self.result


def show_error(title, message):
    messagebox.showerror(title, message)

def show_warning(title, message):
    messagebox.showwarning(title, message)
    
def show_info(title, message):
    messagebox.showinfo(title, message)