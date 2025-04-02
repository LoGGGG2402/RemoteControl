"""
Main entry point for the RemoteControl Agent
"""
import sys
import signal
from agent.core.agent import Agent
from agent.core.utils import logger

def handle_exit_signal(sig, frame):
    """Handle termination signals gracefully."""
    logger.info(f"Received signal {sig}, initiating shutdown...")
    if hasattr(handle_exit_signal, 'agent') and handle_exit_signal.agent:
        logger.info("Calling cleanup on agent instance...")
        handle_exit_signal.agent.cleanup()
    logger.info("Exit handler complete.")
    sys.exit(0)

if __name__ == "__main__":
    # Register signal handlers
    signal.signal(signal.SIGINT, handle_exit_signal)
    signal.signal(signal.SIGTERM, handle_exit_signal)
    
    # Initialize agent
    logger.info("Starting RemoteControl Agent...")
    agent = Agent()
    
    # Store agent reference for signal handler
    handle_exit_signal.agent = agent
    
    # Run the agent
    try:
        agent.run()
    except KeyboardInterrupt:
        logger.info("KeyboardInterrupt received in main thread")
        agent.cleanup()
    except Exception as e:
        logger.error(f"Unhandled exception in main thread: {e}", exc_info=True)
        agent.cleanup()
        raise
    finally:
        logger.info("Agent main thread exiting")
