import tkinter as tk
from tkinter import messagebox
from tkinter import ttk
import urllib.parse # For basic URL parsing/validation
import sys

# Local imports
from . import logger # Assuming logger is in the same directory or configured

class SetupDialog:
    """Creates and manages a configuration dialog for the agent.

    Used for initial setup or updating existing configuration.
    Displays a modal Tkinter window.
    """
    def __init__(self, initial_values=None):
        """Initializes the configuration dialog.

        Args:
            initial_values (dict, optional): Dictionary containing current configuration
                                             values to pre-fill the input fields.
                                             Defaults to None (for first-time setup).
                                             Expected keys: 'server_link', 'room_name',
                                             'row_index' (0-based), 'column_index' (0-based).
        """
        self.result = None # Stores the configuration dict if user clicks OK

        # Create the main Tkinter window (toplevel)
        self.root = tk.Tk()
        self.root.title("Agent Configuration")
        # Center the window (simple approach)
        self.root.geometry("450x220+300+200") # width x height + x_offset + y_offset
        self.root.resizable(False, False)

        # Main frame for widgets
        frame = ttk.Frame(self.root, padding="10 10 10 10")
        frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)

        # --- Labels and Entry Fields --- 
        ttk.Label(frame, text="Server Link:").grid(row=0, column=0, sticky=tk.W, pady=3)
        self.server_link_entry = ttk.Entry(frame, width=45)
        self.server_link_entry.grid(row=0, column=1, padx=5, pady=3, sticky=tk.EW)

        ttk.Label(frame, text="Room Name:").grid(row=1, column=0, sticky=tk.W, pady=3)
        self.room_name_entry = ttk.Entry(frame, width=45)
        self.room_name_entry.grid(row=1, column=1, padx=5, pady=3, sticky=tk.EW)

        # Frame for row/column to keep them together
        index_frame = ttk.Frame(frame)
        index_frame.grid(row=2, column=0, columnspan=2, sticky=tk.W, pady=5)

        ttk.Label(index_frame, text="Row Index (1-based):").grid(row=0, column=0, sticky=tk.W, padx=(0, 10))
        self.row_index_entry = ttk.Entry(index_frame, width=10)
        self.row_index_entry.grid(row=0, column=1, sticky=tk.W)

        ttk.Label(index_frame, text="Column Index (1-based):").grid(row=0, column=2, sticky=tk.W, padx=(20, 10))
        self.column_index_entry = ttk.Entry(index_frame, width=10)
        self.column_index_entry.grid(row=0, column=3, sticky=tk.W)

        # --- Pre-fill values if provided --- 
        if initial_values:
            logger.info("Populating dialog with initial values.")
            self.server_link_entry.insert(0, initial_values.get("server_link", ""))
            self.room_name_entry.insert(0, initial_values.get("room_name", ""))
            # Display 1-based index to the user, store 0-based internally
            row_val_0based = initial_values.get("row_index")
            col_val_0based = initial_values.get("column_index")
            if row_val_0based is not None:
                self.row_index_entry.insert(0, str(row_val_0based + 1))
            if col_val_0based is not None:
                self.column_index_entry.insert(0, str(col_val_0based + 1))
        else:
            # Default placeholder for first-time setup
            logger.info("No initial values provided, showing placeholder.")
            self.server_link_entry.insert(0, "http://your_server_ip_or_domain:port")

        # --- Buttons --- 
        button_frame = ttk.Frame(frame)
        button_frame.grid(row=3, column=0, columnspan=2, pady=20)

        self.ok_button = ttk.Button(button_frame, text="OK", command=self._on_submit, width=10)
        self.ok_button.pack(side=tk.LEFT, padx=10)

        self.cancel_button = ttk.Button(button_frame, text="Cancel", command=self._on_cancel, width=10)
        self.cancel_button.pack(side=tk.LEFT)

        # --- Event Handling --- 
        # Handle window close (X button)
        self.root.protocol("WM_DELETE_WINDOW", self._on_cancel)
        # Bind Enter key to submit
        self.root.bind('<Return>', lambda event=None: self.ok_button.invoke())
        # Bind Escape key to cancel
        self.root.bind('<Escape>', lambda event=None: self.cancel_button.invoke())

        # Make the dialog modal and focus
        self.root.grab_set() # Prevent interaction with other windows (if any)
        self.root.focus_set()
        self.server_link_entry.focus() # Set initial focus
        self.root.wait_window() # Wait until the window is destroyed

    def _on_cancel(self):
        """Handles dialog cancellation (Cancel button or X button)."""
        logger.info("Configuration dialog cancelled by user.")
        self.result = None # Ensure result is None on cancel
        if self.root:
            self.root.destroy()
            self.root = None

    def _validate_input(self, server_link, room_name, row_input, col_input):
        """Validates the user input fields."""
        # Validate Server Link (basic check)
        try:
            parsed = urllib.parse.urlparse(server_link)
            if not all([parsed.scheme in ["http", "https"], parsed.netloc]):
                messagebox.showerror("Input Error", "Invalid Server Link format. Must include http:// or https:// and a domain/IP.", parent=self.root)
                return None, None, None, None
        except ValueError:
             messagebox.showerror("Input Error", "Invalid Server Link format.", parent=self.root)
             return None, None, None, None

        # Validate Room Name
        if not room_name:
            messagebox.showerror("Input Error", "Room Name is required.", parent=self.root)
            return None, None, None, None

        # Validate Row/Column Index
        if not row_input or not col_input:
             messagebox.showerror("Input Error", "Row and Column Index are required.", parent=self.root)
             return None, None, None, None

        try:
            row_val_1based = int(row_input)
            col_val_1based = int(col_input)
            if row_val_1based < 1 or col_val_1based < 1:
                messagebox.showerror("Input Error", "Row and Column Index must be 1 or greater.", parent=self.root)
                return None, None, None, None
        except ValueError:
             messagebox.showerror("Input Error", "Row and Column Index must be numbers.", parent=self.root)
             return None, None, None, None

        # Convert to 0-based index for internal use
        row_val_0based = row_val_1based - 1
        col_val_0based = col_val_1based - 1

        return server_link, room_name, row_val_0based, col_val_0based

    def _on_submit(self):
        """Handles the OK button click, validates input, and stores the result."""
        logger.debug("Submit button clicked.")
        server_link = self.server_link_entry.get().strip()
        room_name = self.room_name_entry.get().strip()
        row_input = self.row_index_entry.get().strip()
        col_input = self.column_index_entry.get().strip()

        # Validate all inputs
        s_link, r_name, r_idx, c_idx = self._validate_input(server_link, room_name, row_input, col_input)

        if s_link is not None: # Validation succeeded if first value is not None
            self.result = {
                "server_link": s_link,
                "room_name": r_name,
                "row_index": r_idx, # Store 0-based index
                "column_index": c_idx, # Store 0-based index
            }
            logger.info(f"Configuration submitted: {self.result}")
            if self.root:
                self.root.destroy()
                self.root = None
        # else: Validation failed, message box already shown, do not close dialog

    def get_result(self):
        """Returns the configuration dictionary entered by the user.

        This method should be called *after* the dialog has been initialized and closed.
        The dialog runs its main loop in the __init__ method.

        Returns:
            dict or None: Configuration dictionary if OK was clicked and validation passed,
                          otherwise None (if cancelled or closed).
        """
        # The main loop runs in __init__, this just returns the stored result.
        return self.result

def show_error(title, message):
    """Displays a simple error message box.

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
             # If a root exists, show the messagebox relative to it (might not be ideal)
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
    """Shows an information dialog box"""
    root = tk.Tk()
    root.withdraw()  # Hide the main window
    messagebox.showinfo(title, message)
    root.destroy()  # Clean up the root window

def show_question(title, message, options=None):
    """Shows a dialog box with a question and custom buttons.
    
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
        msg_frame = ttk.Frame(dialog, padding=10)
        msg_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        
        # Message text (using a Label with wraplength)
        msg_label = ttk.Label(
            msg_frame, 
            text=message, 
            wraplength=360,  # Wrap text to avoid dialog becoming too wide
            justify=tk.LEFT
        )
        msg_label.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Button frame
        btn_frame = ttk.Frame(dialog, padding=10)
        btn_frame.pack(fill=tk.X, padx=20, pady=(0, 20))
        
        # Add buttons based on provided options
        for option in options:
            button = ttk.Button(
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

# Add a progress dialog for long-running operations like validation
class ProgressDialog:
    def __init__(self, title="Please wait", message="Operation in progress..."):
        self.root = tk.Tk()
        self.root.title(title)
        self.root.geometry("300x100")
        self.root.resizable(False, False)
        
        # Center the window
        self.root.eval('tk::PlaceWindow . center')
        
        # Add a label with the message
        self.label = tk.Label(self.root, text=message, padx=20, pady=10)
        self.label.pack()
        
        # Add a progress bar
        self.progress = ttk.Progressbar(self.root, mode="indeterminate", length=250)
        self.progress.pack(pady=10)
        self.progress.start(10)  # Start animation
        
        # Make the dialog modal
        self.root.grab_set()
        self.root.transient()
        self.root.focus_set()
        
        # Update the UI
        self.root.update()
    
    def update_message(self, message):
        """Updates the message text"""
        self.label.config(text=message)
        self.root.update()
    
    def close(self):
        """Closes the progress dialog"""
        self.progress.stop()
        self.root.grab_release()
        self.root.destroy()