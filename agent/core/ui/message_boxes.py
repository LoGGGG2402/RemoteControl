# agent/core/ui/message_boxes.py
import tkinter as tk
from tkinter import messagebox
import sys
import agent.core.utils.logger as logger

def show_error(title, message):
    """
    Displays a simple error message box.
    Creates a temporary hidden Tk root window if necessary.
    
    Args:
        title (str): The title of the message box window.
        message (str): The error message to display.
    """
    logger.warning(f"Displaying error message box: Title='{title}', Message='{message}'")
    
    try:
        # Check if a Tk root window already exists
        # Creating multiple Tk() instances is generally discouraged
        if tk._default_root:
            # If a root exists, show the messagebox relative to it
            messagebox.showerror(title, message)
        else:
            # Create a temporary, hidden root window
            root = tk.Tk()
            root.withdraw() # Hide the root window
            messagebox.showerror(title, message, parent=root) # Associate with hidden root
            root.destroy()
    except Exception as e:
        # Fallback if Tkinter operations fail unexpectedly
        logger.error(f"Failed to display error message box using Tkinter: {e}")
        # Optionally log to console as a last resort
        print(f"ERROR: {title} - {message}", file=sys.stderr)

def show_info(title, message):
    """
    Shows an information dialog box
    
    Args:
        title (str): The title of the dialog
        message (str): The message to display
    """
    logger.info(f"Displaying info message box: Title='{title}', Message='{message}'")
    
    try:
        if tk._default_root:
            messagebox.showinfo(title, message)
        else:
            root = tk.Tk()
            root.withdraw()  # Hide the main window
            messagebox.showinfo(title, message, parent=root)
            root.destroy()  # Clean up the root window
    except Exception as e:
        logger.error(f"Failed to display info message box using Tkinter: {e}")
        print(f"INFO: {title} - {message}")

def show_question(title, message, options=None):
    """
    Shows a dialog box with a question and custom buttons.
    
    Args:
        title (str): The title of the dialog
        message (str): The question or message to display
        options (list, optional): List of strings for button labels. 
                                 Defaults to ["Yes", "No"] if None.
    
    Returns:
        str: The label of the button that was clicked
    """
    if options is None:
        options = ["Yes", "No"]
        
    logger.info(f"Showing question dialog: {title} - with options: {options}")
    
    result = [None]  # Use a list to store result from within the callback
    
    def create_dialog():
        dialog = tk.Toplevel()
        dialog.title(title)
        dialog.geometry("400x250")  # Width x Height
        dialog.resizable(False, False)
        
        # Center the dialog
        dialog.withdraw()  # Hide temporarily to position correctly
        dialog.update_idletasks()  # Update "requested size" from geometry manager
        
        # Calculate center position
        x = (dialog.winfo_screenwidth() - dialog.winfo_reqwidth()) // 2
        y = (dialog.winfo_screenheight() - dialog.winfo_reqheight()) // 2
        dialog.geometry(f"+{x}+{y}")  # Position dialog at center
        
        dialog.deiconify()  # Show the dialog
        # Make the dialog modal
        dialog.transient()
        dialog.grab_set()
        dialog.focus_force()
        
        # Message frame
        msg_frame = tk.Frame(dialog, padx=10, pady=10)
        msg_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        
        # Message text (using a Label with wraplength)
        msg_label = tk.Label(
            msg_frame, 
            text=message, 
            wraplength=360,  # Wrap text to avoid dialog becoming too wide
            justify=tk.LEFT
        )
        msg_label.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Button frame
        btn_frame = tk.Frame(dialog, padx=10, pady=10)
        btn_frame.pack(fill=tk.X, padx=20, pady=(0, 20))
        
        # Add buttons based on provided options
        for option in options:
            button = tk.Button(
                btn_frame, 
                text=option,
                command=lambda o=option: [result.__setitem__(0, o), dialog.destroy()]
            )
            button.pack(side=tk.LEFT, padx=10)
        
        # Prevent closing with X button
        dialog.protocol("WM_DELETE_WINDOW", lambda: None)
        
        # Wait for user interaction
        dialog.wait_window()
    
    # Handle Tkinter operation
    try:
        if tk._default_root and tk._default_root.winfo_exists():
            create_dialog()
        else:
            root = tk.Tk()
            root.withdraw()
            create_dialog()
            root.destroy()
    except Exception as e:
        logger.error(f"Error displaying question dialog: {e}")
        # Default to first option if dialog fails
        result[0] = options[0] if options else "Yes"
        
    logger.info(f"User selected: {result[0]}")
    return result[0]