import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaUserAstronaut } from "react-icons/fa";
import { ImSpinner8 } from "react-icons/im";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "../utils/api";

const LoginPage = () => {
    let navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const commonDomains = [
        "@gmail.com",
        "@example.com",
        "@yahoo.com",
        "@hotmail.com",
        "@outlook.com",
    ];

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    };

    const handleEmailChange = (e) => {
        const value = e.target.value;
        setEmail(value);
        if (!validateEmail(value) && value !== "") {
            setEmailError("Invalid email format");
        } else {
            setEmailError("");
        }
    };

    const handlePasswordChange = (e) => {
        const value = e.target.value;
        setPassword(value);
        if (value.length < 4 && value !== "") {
            setPasswordError("Password must be at least 4 characters long");
        } else {
            setPasswordError("");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const response = await auth.login({ email, password });
            if (response.data.user) {
                window.location.href = "/";
            }
        } catch (error) {
            if (error.response) {
                setError(
                    `Server error: ${
                        error.response.data.message || error.response.statusText
                    }`
                );
            } else if (error.request) {
                setError(
                    "No response from server. Please check your network connection and try again."
                );
            } else {
                setError(`Error: ${error.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Announce errors for screen readers
        if (emailError) {
            document.getElementById("emailError").focus();
        } else if (passwordError) {
            document.getElementById("passwordError").focus();
        }
    }, [emailError, passwordError]);

    const fadeIn = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
    };

    return (
        <div className='min-h-screen flex items-center justify-center bg-gray-100 p-4'>
            <motion.div
                variants={fadeIn}
                initial='initial'
                animate='animate'
                exit='exit'
                className='bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md relative'
            >
                {/* Logo Section with enhanced animation */}
                <motion.div
                    className='text-center mb-8'
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className='relative h-24 w-24 mx-auto mb-4'>
                        <motion.div
                            className='absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full'
                            animate={{
                                scale: [1, 1.2, 1],
                                rotate: [0, 180, 360],
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "linear",
                            }}
                        />
                        <FaUserAstronaut className='relative h-full w-full text-white p-4' />
                    </div>
                    <h2 className='text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'>
                        Welcome Back
                    </h2>
                    <p className='text-gray-600 mt-2'>
                        Please sign in to continue
                    </p>
                </motion.div>

                {/* Enhanced Form Section */}
                <form onSubmit={handleSubmit} className='space-y-6'>
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                    >
                        <label
                            htmlFor='email'
                            className='block text-sm font-medium text-gray-700'
                        >
                            Email
                        </label>
                        <div className='mt-1 relative'>
                            <input
                                type='email'
                                id='email'
                                name='email'
                                value={email}
                                onChange={handleEmailChange}
                                required
                                className={`appearance-none block w-full px-3 py-2 border ${
                                    emailError
                                        ? "border-red-500"
                                        : "border-gray-300"
                                } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out`}
                                placeholder='Enter your email'
                                list='emailSuggestions'
                                aria-invalid={emailError ? "true" : "false"}
                                aria-describedby={
                                    emailError ? "emailError" : undefined
                                }
                            />
                            <datalist id='emailSuggestions'>
                                {commonDomains.map((domain) => (
                                    <option
                                        key={domain}
                                        value={`${
                                            email.split("@")[0]
                                        }${domain}`}
                                    />
                                ))}
                            </datalist>
                        </div>
                        {emailError && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                id='emailError'
                                className='mt-2 text-sm text-red-600'
                                role='alert'
                            >
                                {emailError}
                            </motion.p>
                        )}
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                    >
                        <label
                            htmlFor='password'
                            className='block text-sm font-medium text-gray-700'
                        >
                            Password
                        </label>
                        <div className='mt-1 relative'>
                            <input
                                type={showPassword ? "text" : "password"}
                                id='password'
                                name='password'
                                value={password}
                                onChange={handlePasswordChange}
                                required
                                className={`appearance-none block w-full px-3 py-2 border ${
                                    passwordError
                                        ? "border-red-500"
                                        : "border-gray-300"
                                } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out`}
                                placeholder='Enter your password'
                                aria-invalid={passwordError ? "true" : "false"}
                                aria-describedby={
                                    passwordError ? "passwordError" : undefined
                                }
                            />
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                type='button'
                                className='absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5'
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? (
                                    <FaEyeSlash className='h-5 w-5 text-gray-400' />
                                ) : (
                                    <FaEye className='h-5 w-5 text-gray-400' />
                                )}
                            </motion.button>
                        </div>
                        {passwordError && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                id='passwordError'
                                className='mt-2 text-sm text-red-600'
                                role='alert'
                            >
                                {passwordError}
                            </motion.p>
                        )}
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.5 }}
                    >
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            type='submit'
                            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out ${
                                isLoading ? "opacity-75 cursor-not-allowed" : ""
                            }`}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <ImSpinner8 className='animate-spin -ml-1 mr-3 h-5 w-5 text-white' />
                                    Processing...
                                </>
                            ) : (
                                "Login"
                            )}
                        </motion.button>
                    </motion.div>
                </form>

                {/* Enhanced Error Display */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className='mt-4 p-3 rounded-lg bg-red-100 text-red-700 text-sm border border-red-200'
                        >
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default LoginPage;
