# agent/core/command/task_executor.py
import queue
import threading
import agent.core.utils.logger as logger

class TaskExecutor:
    """
    Responsible for executing heavy or long-running tasks asynchronously
    in a background thread to keep the main thread and UI responsive.
    """
    
    def __init__(self, completion_callback=None):
        """
        Initialize the TaskExecutor with a task queue and worker thread
        
        Args:
            completion_callback: Function to call when a task completes,
                                 with signature (success, result, command_type, task_id)
        """
        self.task_queue = queue.Queue()
        self.worker_thread = None
        self.is_running = False
        self.completion_callback = completion_callback
        
    def start(self):
        """Start the task executor worker thread"""
        if not self.worker_thread or not self.worker_thread.is_alive():
            self.is_running = True
            self.worker_thread = threading.Thread(
                target=self._process_tasks,
                daemon=True
            )
            self.worker_thread.start()
            logger.info("Task executor worker thread started")
            
    def queue_task(self, func, args=(), kwargs=None, command_type=None, task_id=None):
        """
        Add a task to the execution queue
        
        Args:
            func: Function to execute
            args: Positional arguments for the function (tuple)
            kwargs: Keyword arguments for the function (dict)
            command_type: Type of command this task is for (for reporting)
            task_id: ID of the task for tracking
            
        Returns:
            bool: True if task was queued successfully
        """
        if not self.is_running:
            logger.error("Cannot queue task: TaskExecutor is not running")
            return False
            
        if kwargs is None:
            kwargs = {}
            
        logger.info(f"Queueing task: {func.__name__} (Command: {command_type}, Task ID: {task_id})")
        self.task_queue.put((func, args, kwargs, command_type, task_id))
        return True
        
    def _process_tasks(self):
        """Worker thread function to process tasks from the queue"""
        logger.info("Task processing worker thread started")
        
        while self.is_running:
            try:
                # Get a task from the queue with timeout for checking is_running
                try:
                    task = self.task_queue.get(timeout=1.0)
                except queue.Empty:
                    continue
                    
                # Check for stop signal
                if task is None:
                    logger.info("Task processing worker thread received stop signal")
                    break
                    
                # Unpack task data
                func, args, kwargs, command_type, task_id = task
                
                logger.info(f"Processing task: {func.__name__} (Command: {command_type}, Task ID: {task_id})")
                
                # Execute the task
                try:
                    result = func(*args, **kwargs)
                    success = True
                    logger.info(f"Task {func.__name__} completed successfully")
                except Exception as e:
                    logger.error(f"Error executing task {func.__name__}: {e}")
                    result = str(e)
                    success = False
                    
                # Report completion if callback exists
                if self.completion_callback:
                    try:
                        self.completion_callback(success, result, command_type, task_id)
                    except Exception as callback_error:
                        logger.error(f"Error in task completion callback: {callback_error}")
                        
                # Mark task as done in the queue
                self.task_queue.task_done()
                
            except Exception as e:
                logger.error(f"Unexpected error in task processing loop: {e}")
                continue
                
        logger.info("Task processing worker thread stopped")
        
    def stop(self):
        """Stop the task executor and its worker thread"""
        if not self.is_running:
            logger.info("TaskExecutor already stopped")
            return
            
        logger.info("Stopping TaskExecutor...")
        self.is_running = False
        
        # Add a sentinel value to signal the worker to stop
        self.task_queue.put(None)
        
        # Wait for worker thread to finish
        if self.worker_thread and self.worker_thread.is_alive():
            logger.info("Waiting for worker thread to finish...")
            self.worker_thread.join(timeout=2)
            
            if self.worker_thread.is_alive():
                logger.warning("Worker thread did not stop within timeout")
            else:
                logger.info("Worker thread stopped successfully")
                
        logger.info("TaskExecutor stopped")