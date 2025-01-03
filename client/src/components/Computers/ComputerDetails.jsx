import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import { computers, applications as appsApi, files as filesApi } from "../../utils/api";
import {
    FaServer,
    FaNetworkWired,
    FaDownload,
    FaTrash,
    FaSpinner,
    FaUser,
    FaClock,
    FaMemory,
    FaPercent,
    FaTerminal,
    FaGlobe,
    FaDesktop,
    FaKeyboard,
    FaBuilding,
    FaStickyNote,
    FaExclamationTriangle,
    FaSync,
    FaMapMarkerAlt,
    FaThLarge,
    FaEdit,
    FaCheck,
} from "react-icons/fa";

const ComputerDetails = () => {
    const { id } = useParams();
    const location = useLocation();
    const initialTab = location.state?.activeTab || "applications";
    const [computer, setComputer] = useState(null);
    const [processes, setProcesses] = useState([]);
    const [networkActivities, setNetworkActivities] = useState([]);
    const [applications, setApplications] = useState([]);
    const [availableApps, setAvailableApps] = useState([]);
    const [files, setFiles] = useState([]);
    const [availableFiles, setAvailableFiles] = useState([]);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [installing, setInstalling] = useState(false);
    const [installError, setInstallError] = useState(null);
    const [processesLoading, setProcessesLoading] = useState(false);
    const [networkLoading, setNetworkLoading] = useState(false);
    const [appsLoading, setAppsLoading] = useState(false);
    const [filesLoading, setFilesLoading] = useState(false);
    const [uninstalling, setUninstalling] = useState(false);
    const [uninstallError, setUninstallError] = useState(null);
    const [editing, setEditing] = useState(false);
    const [editNotes, setEditNotes] = useState("");
    const [editErrors, setEditErrors] = useState("");
    const [updateError, setUpdateError] = useState(null);
    const [errors, setErrors] = useState([]);
    const [errorType, setErrorType] = useState('hardware');
    const [errorDescription, setErrorDescription] = useState('');
    const [isAddingError, setIsAddingError] = useState(false);
    const [showErrorTable, setShowErrorTable] = useState(true);
    const [errorFilter, setErrorFilter] = useState('all'); // 'all', 'active', 'resolved'

    const filteredErrors = errors.filter(error => {
        if (errorFilter === 'active') return !error.resolved_at;
        if (errorFilter === 'resolved') return error.resolved_at;
        return true;
    });

    useEffect(() => {
        const init = async () => {
            await loadComputerData();

            // Load data based on initial tab
            if (initialTab === "applications") {
                await loadApplicationsData();
            } else if (initialTab === "processes") {
                await loadProcesses();
            } else if (initialTab === "network") {
                await loadNetworkActivities();
            } else if (initialTab === "files" && files.length === 0) {
                await loadFilesData();
            }
        };
        init();
    }, [id, initialTab]);

    useEffect(() => {
        if (computer) {
            setEditNotes(computer.notes || "");
            setEditErrors(computer.errors || "");
        }
    }, [computer]);

    useEffect(() => {
        const loadErrors = async () => {
            try {
                const response = await computers.getErrors(id);
                setErrors(response.data);
            } catch (err) {
                console.error("Failed to load errors:", err);
            }
        };
        
        if (computer?.id) {
            loadErrors();
        }
    }, [computer?.id]);

    const loadComputerData = async () => {
        try {
            const computerRes = await computers.get(id);
            setComputer(computerRes.data);
            setError(null);
        } catch (err) {
            setError(err.response?.data || "Failed to load computer data");
        } finally {
            setLoading(false);
        }
    };

    const loadProcesses = async () => {
        setProcessesLoading(true);
        if (!computer.online) {
            setError("Computer is offline. Please try again when it's online.");
            setProcessesLoading(false);
            return;
        }
        try {
            const res = await computers.getProcesses(id);
            setProcesses(res.data.processList.data || []);
        } catch (err) {
            setError(err.response?.data || "Failed to load processes");
        } finally {
            setProcessesLoading(false);
        }
    };

    const loadNetworkActivities = async () => {
        setNetworkLoading(true);
        if (!computer.online) {
            setError("Computer is offline. Please try again when it's online.");
            setNetworkLoading(false);
            return;
        }
        try {
            const res = await computers.getNetActivities(id);
            setNetworkActivities(res.data.networkConnections.data || []);
        } catch (err) {
            setError(err.response?.data || "Failed to load network activities");
        } finally {
            setNetworkLoading(false);
        }
    };

    const loadApplicationsData = async () => {
        setAppsLoading(true);
        try {
            const [appsRes, availableRes] = await Promise.all([
                computers.getApplications(id),
                appsApi.all(),
            ]);
            setApplications(appsRes.data || []);
            setAvailableApps(availableRes.data);
        } catch (err) {
            setError(err.response?.data || "Failed to load applications");
        } finally {
            setAppsLoading(false);
        }
    };

    const loadFilesData = async () => {
        setFilesLoading(true);
        try {
            const [filesRes, availableRes] = await Promise.all([
                computers.getFiles(id),
                filesApi.all(),
            ]);
            setFiles(filesRes.data || []);
            setAvailableFiles(availableRes.data);
        } catch (err) {
            console.log(err);
            setError(err.response?.data || "Failed to load files");
        } finally {
            setFilesLoading(false);
        }
    };

    const handleInstallApp = async (application_id) => {
        setInstalling(true);
        setInstallError(null);

        if (!computer.online) {
            setInstallError(
                "Computer is offline. Installation requires the computer to be online."
            );
            setInstalling(false);
            return;
        }

        try {
            await computers.installApplication({
                id: id,
                application_id: application_id,
            });
            // Refresh applications list after successful installation
            await loadApplicationsData();
        } catch (err) {
            setInstallError(
                err.response?.data?.error || "Failed to install application"
            );
            console.error("Installation error:", err);
        } finally {
            setInstalling(false);
        }
    };

    const handleUninstallApp = async (application_id) => {
        if (
            !window.confirm(
                "Are you sure you want to uninstall this application?"
            )
        ) {
            return;
        }

        setUninstalling(true);
        setUninstallError(null);

        if (!computer.online) {
            setUninstallError(
                "Computer is offline. Uninstallation requires the computer to be online."
            );
            setUninstalling(false);
            return;
        }
        try {
            await computers.uninstallApplication(id, application_id);
            // Refresh applications list after successful uninstallation
            await loadApplicationsData();
        } catch (err) {
            setUninstallError(
                err.response?.data?.error || "Failed to uninstall application"
            );
            console.error("Uninstallation error:", err);
        } finally {
            setUninstalling(false);
        }
    };

    const handleInstallFile = async (file_id) => {
        setInstalling(true);
        setInstallError(null);

        if (!computer.online) {
            setInstallError(
                "Computer is offline. Installation requires the computer to be online."
            );
            setInstalling(false);
            return;
        }

        try {
            await computers.installFile(id, file_id);
            // Refresh files list after successful installation
            await loadFilesData();
        } catch (err) {
            setInstallError(
                err.response?.data?.error || "Failed to install file"
            );
            console.error("Installation error:", err);
        } finally {
            setInstalling(false);
        }
    };

    const handleUninstallFile = async (file_id) => {
        if (
            !window.confirm(
                "Are you sure you want to uninstall this file?"
            )
        ) {
            return;
        }

        setUninstalling(true);
        setUninstallError(null);

        if (!computer.online) {
            setUninstallError(
                "Computer is offline. Uninstallation requires the computer to be online."
            );
            setUninstalling(false);
            return;
        }
        try {
            await computers.uninstallFile(id, file_id);
            // Refresh files list after successful uninstallation
            await loadFilesData();
        } catch (err) {
            setUninstallError(
                err.response?.data?.error || "Failed to uninstall file"
            );
            console.error("Uninstallation error:", err);
        } finally {
            setUninstalling(false);
        }
    };

    const handleUpdateNotesAndErrors = async () => {
        try {
            await computers.updateNotes(id, {
                notes: editNotes,
            });
            await loadComputerData(); // Refresh computer data
            setEditing(false);
            setUpdateError(null);
        } catch (err) {
            setUpdateError(
                err.response?.data || "Failed to update notes and errors"
            );
        }
    };

    const handleTabClick = (tab) => {
        setActiveTab(tab);
        if (tab === "processes" && processes.length === 0) {
            loadProcesses();
        } else if (tab === "network" && networkActivities.length === 0) {
            loadNetworkActivities();
        } else if (tab === "applications" && applications.length === 0) {
            loadApplicationsData();
        } else if (tab === "files" && files.length === 0) {
            loadFilesData();
        }
    };

    const handleAddError = async () => {
        try {
            await computers.addError(computer.id, {
                error_type: errorType,
                description: errorDescription
            });
            
            // Reload errors
            const response = await computers.getErrors(computer.id);
            setErrors(response.data);
            
            // Reset form
            setErrorDescription('');
            setIsAddingError(false);
        } catch (err) {
            setUpdateError("Failed to add error");
        }
    };

    const handleResolveError = async (errorId) => {
        try {
            await computers.resolveError(computer.id, errorId);
            
            // Reload errors
            const response = await computers.getErrors(computer.id);
            setErrors(response.data);
        } catch (err) {
            setUpdateError("Failed to resolve error");
        }
    };

    if (loading)
        return (
            <div className='flex items-center justify-center min-h-screen'>
                <FaSpinner className='animate-spin text-4xl text-blue-500' />
            </div>
        );

    return (
        <div className='container mx-auto px-6 py-8'>
            <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
                <h1 className='text-2xl font-bold mb-6 flex items-center gap-2'>
                    <FaServer className='text-blue-500' />
                    Computer Details
                    <span
                        className={`ml-2 px-2 py-1 text-sm rounded-full ${
                            computer.online
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                        }`}
                    >
                        {computer.online ? "Online" : "Offline"}
                    </span>
                </h1>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    <div className='space-y-4'>
                        <div className='flex items-center gap-3'>
                            <FaDesktop className='text-gray-500' />
                            <div>
                                <p className='text-sm text-gray-500'>
                                    Computer ID
                                </p>
                                <p className='font-medium'>{computer.id}</p>
                            </div>
                        </div>
                        <div className='flex items-center gap-3'>
                            <FaKeyboard className='text-gray-500' />
                            <div>
                                <p className='text-sm text-gray-500'>
                                    Hostname
                                </p>
                                <p className='font-medium'>
                                    {computer.hostname}
                                </p>
                            </div>
                        </div>
                        <div className='flex items-center gap-3'>
                            <FaGlobe className='text-gray-500' />
                            <div>
                                <p className='text-sm text-gray-500'>
                                    IP Address
                                </p>
                                <p className='font-medium'>
                                    {computer.ip_address}
                                </p>
                            </div>
                        </div>
                        <div className='flex items-center gap-3'>
                            <FaNetworkWired className='text-gray-500' />
                            <div>
                                <p className='text-sm text-gray-500'>
                                    MAC Address
                                </p>
                                <p className='font-medium'>
                                    {computer.mac_address}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className='space-y-4'>
                        <div className='flex items-center gap-3'>
                            <FaBuilding className='text-gray-500' />
                            <div>
                                <p className='text-sm text-gray-500'>Room</p>
                                <div className='flex items-center gap-2'>
                                    <span className='font-medium text-lg'>
                                        {computer.room_id}
                                    </span>
                                    <span className='text-gray-400'>|</span>
                                    <span className='text-sm text-gray-600'>
                                        Building{" "}
                                        {Math.floor(computer.room_id / 100)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className='flex items-center gap-3'>
                            <FaMapMarkerAlt className='text-gray-500' />
                            <div>
                                <p className='text-sm text-gray-500'>
                                    Position
                                </p>
                                <div className='mt-1 inline-flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-lg'>
                                    <FaThLarge className='text-gray-500' />
                                    <span className='font-medium'>
                                        Row {computer.row_index}
                                    </span>
                                    <span className='text-gray-400'>•</span>
                                    <span className='font-medium'>
                                        Col {computer.column_index}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className='space-y-4'>
                            {editing ? (
                                <div className='space-y-4 bg-gray-50 p-4 rounded-lg'>
                                    <div>
                                        <label className='block text-sm font-medium text-gray-700'>
                                            Notes
                                        </label>
                                        <textarea
                                            value={editNotes}
                                            onChange={(e) =>
                                                setEditNotes(e.target.value)
                                            }
                                            className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
                                            rows={3}
                                            placeholder='Add notes about this computer...'
                                        />
                                    </div>
                                    <div className='flex gap-2'>
                                        <button
                                            onClick={handleUpdateNotesAndErrors}
                                            className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
                                        >
                                            Save Changes
                                        </button>
                                        <button
                                            onClick={() => setEditing(false)}
                                            className='px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600'
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className='space-y-4'>
                                    <div>
                                        <div className='flex items-center justify-between mb-2'>
                                            <h3 className='text-lg font-medium flex items-center gap-2'>
                                                <FaStickyNote className='text-blue-500' />
                                                Notes
                                            </h3>
                                            <button
                                                onClick={() => setEditing(true)}
                                                className='px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 flex items-center gap-1'
                                            >
                                                <FaEdit />
                                                Edit Notes
                                            </button>
                                        </div>
                                        <div className='bg-gray-50 p-4 rounded-lg'>
                                            {computer.notes ? (
                                                <p className='text-gray-600 whitespace-pre-line'>
                                                    {computer.notes}
                                                </p>
                                            ) : (
                                                <p className='text-gray-400 italic'>
                                                    No notes added
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className='space-y-4'>
                            <div>
                                <div className='flex items-center justify-between mb-2'>
                                    <h3 className='text-lg font-medium flex items-center gap-2'>
                                        <FaExclamationTriangle className='text-red-500' />
                                        Error Management
                                        <span className='text-sm text-gray-500'>
                                            ({errors.filter(e => !e.resolved_at).length} active)
                                        </span>
                                    </h3>
                                    <div className='flex items-center gap-2'>
                                        <select
                                            value={errorFilter}
                                            onChange={(e) => setErrorFilter(e.target.value)}
                                            className='text-sm border rounded px-2 py-1.5'
                                        >
                                            <option value="all">All Errors</option>
                                            <option value="active">Active Only</option>
                                            <option value="resolved">Resolved Only</option>
                                        </select>
                                        <button
                                            onClick={() => setShowErrorTable(!showErrorTable)}
                                            className='px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded hover:bg-gray-200 flex items-center gap-1'
                                        >
                                            {showErrorTable ? 'Hide' : 'Show'} Table
                                        </button>
                                        <button
                                            onClick={() => setIsAddingError(true)}
                                            className='px-3 py-1.5 bg-red-500 text-white text-sm rounded hover:bg-red-600 flex items-center gap-1'
                                        >
                                            <FaExclamationTriangle />
                                            Report Error
                                        </button>
                                    </div>
                                </div>
                                {errors.length > 0 ? (
                                    <div className={`overflow-hidden transition-all duration-300 ${showErrorTable ? 'max-h-[500px]' : 'max-h-0'}`}>
                                        <div className="overflow-x-auto">
                                            <table className='min-w-full divide-y divide-gray-200'>
                                                <thead className='bg-gray-50'>
                                                    <tr>
                                                        <th scope='col' className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24'>
                                                            Type
                                                        </th>
                                                        <th scope='col' className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                                            Description
                                                        </th>
                                                        <th scope='col' className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40'>
                                                            Created At
                                                        </th>
                                                        <th scope='col' className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32'>
                                                            Status
                                                        </th>
                                                        <th scope='col' className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24'>
                                                            Action
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className='bg-white divide-y divide-gray-200'>
                                                    {filteredErrors.map(error => (
                                                        <tr key={error.id} className={error.resolved_at ? 'bg-gray-50' : ''}>
                                                            <td className='px-6 py-4 whitespace-nowrap'>
                                                                <span className='text-xs font-medium px-2 py-1 rounded bg-red-100 text-red-800'>
                                                                    {error.error_type.toUpperCase()}
                                                                </span>
                                                            </td>
                                                            <td className='px-6 py-4'>
                                                                <p className='text-sm text-gray-900 break-words max-w-xs'>{error.description}</p>
                                                            </td>
                                                            <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                                                                {new Date(error.created_at).toLocaleString()}
                                                            </td>
                                                            <td className='px-6 py-4 whitespace-nowrap'>
                                                                {error.resolved_at ? (
                                                                    <div className='text-sm text-green-600'>
                                                                        <div className='flex items-center gap-1'>
                                                                            <FaCheck />
                                                                            <span>Resolved</span>
                                                                        </div>
                                                                        <span className='text-xs text-gray-500'>
                                                                            {new Date(error.resolved_at).toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <span className='text-xs font-medium px-2 py-1 rounded bg-yellow-100 text-yellow-800'>
                                                                        Active
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className='px-6 py-4 whitespace-nowrap text-sm'>
                                                                {!error.resolved_at && (
                                                                    <button
                                                                        onClick={() => handleResolveError(error.id)}
                                                                        className='text-green-600 hover:text-green-900'
                                                                    >
                                                                        Resolve
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className='bg-gray-50 p-4 rounded-lg'>
                                        <p className='text-gray-400 italic'>No errors recorded</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className='flex items-center gap-3'>
                            <FaSync className='text-gray-500' />
                            <div>
                                <p className='text-sm text-gray-500'>
                                    Last Updated
                                </p>
                                <p className='font-medium'>
                                    {new Date(
                                        computer.updated_at
                                    ).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 flex items-center gap-2'>
                    <FaExclamationTriangle />
                    <span>{error}</span>
                </div>
            )}

            {(installing || uninstalling) && (
                <div className='bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6 flex items-center gap-2'>
                    <FaSpinner className='animate-spin' />
                    <span>
                        {installing
                            ? "Installing application..."
                            : "Uninstalling application..."}
                    </span>
                </div>
            )}

            {installError && (
                <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 flex items-center gap-2'>
                    <FaExclamationTriangle />
                    <span>{installError}</span>
                </div>
            )}

            {uninstallError && (
                <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 flex items-center gap-2'>
                    <FaExclamationTriangle />
                    <span>{uninstallError}</span>
                </div>
            )}

            {isAddingError && (
                <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center'>
                    <div className='bg-white p-6 rounded-lg w-full max-w-md'>
                        <h3 className='text-lg font-medium mb-4'>Add New Error</h3>
                        
                        <div className='space-y-4'>
                            <div>
                                <label className='block text-sm font-medium text-gray-700 mb-1'>
                                    Error Type
                                </label>
                                <select
                                    value={errorType}
                                    onChange={(e) => setErrorType(e.target.value)}
                                    className='w-full border rounded p-2'
                                >
                                    <option value="hardware">Hardware</option>
                                    <option value="software">Software</option>
                                    <option value="network">Network</option>
                                    <option value="system">System</option>
                                    <option value="security">Security</option>
                                    <option value="peripheral">Peripheral</option>
                                </select>
                            </div>

                            <div>
                                <label className='block text-sm font-medium text-gray-700 mb-1'>
                                    Description
                                </label>
                                <textarea
                                    value={errorDescription}
                                    onChange={(e) => setErrorDescription(e.target.value)}
                                    className='w-full border rounded p-2'
                                    rows={3}
                                />
                            </div>

                            <div className='flex justify-end gap-2'>
                                <button
                                    onClick={() => setIsAddingError(false)}
                                    className='px-4 py-2 text-sm text-gray-600 hover:text-gray-800'
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddError}
                                    className='px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600'
                                >
                                    Add Error
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className='bg-white rounded-lg shadow-md'>
                <div className='border-b'>
                    <nav className='flex'>
                        {["applications", "processes", "network", "files"].map((tab) => (
                            <button
                                key={tab}
                                className={`px-6 py-3 font-medium ${
                                    activeTab === tab
                                        ? "border-b-2 border-blue-500 text-blue-500"
                                        : "text-gray-500 hover:text-gray-700"
                                }`}
                                onClick={() => handleTabClick(tab)}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className='p-6'>
                    {activeTab === "processes" &&
                        (processesLoading ? (
                            <div className='flex items-center justify-center p-4'>
                                <FaSpinner className='animate-spin text-2xl text-blue-500' />
                            </div>
                        ) : (
                            <div className='overflow-x-auto'>
                                <div className='mb-4 flex justify-end'>
                                    <button
                                        onClick={loadProcesses}
                                        disabled={
                                            processesLoading || !computer.online
                                        }
                                        className='flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300'
                                    >
                                        <FaSync
                                            className={
                                                processesLoading
                                                    ? "animate-spin"
                                                    : ""
                                            }
                                        />
                                        Refresh Processes
                                    </button>
                                </div>
                                <table className='min-w-full divide-y divide-gray-200'>
                                    <thead>
                                        <tr>
                                            <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-1/4'>
                                                <div className='flex items-center space-x-1'>
                                                    <FaTerminal />
                                                    <span>Name</span>
                                                </div>
                                            </th>
                                            <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20'>
                                                <div className='flex items-center space-x-1'>
                                                    <FaDesktop />
                                                    <span>PID</span>
                                                </div>
                                            </th>
                                            <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32'>
                                                <div className='flex items-center space-x-1'>
                                                    <FaUser />
                                                    <span>User</span>
                                                </div>
                                            </th>
                                            <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24'>
                                                <div className='flex items-center space-x-1'>
                                                    <FaPercent />
                                                    <span>CPU</span>
                                                </div>
                                            </th>
                                            <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24'>
                                                <div className='flex items-center space-x-1'>
                                                    <FaMemory />
                                                    <span>RAM</span>
                                                </div>
                                            </th>
                                            <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-40'>
                                                <div className='flex items-center space-x-1'>
                                                    <FaClock />
                                                    <span>Created</span>
                                                </div>
                                            </th>
                                            <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24'>
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className='divide-y divide-gray-200'>
                                        {processes.map((process, idx) => (
                                            <tr
                                                key={`${process.pid}-${idx}`}
                                                className='hover:bg-gray-50'
                                            >
                                                <td className='px-4 py-2 truncate max-w-xs'>
                                                    {process.name}
                                                </td>
                                                <td className='px-4 py-2'>
                                                    {process.pid}
                                                </td>
                                                <td className='px-4 py-2 truncate'>
                                                    {process.username}
                                                </td>
                                                <td className='px-4 py-2'>
                                                    <span
                                                        className={`${
                                                            process.cpu_percent >
                                                            50
                                                                ? "text-red-500"
                                                                : "text-green-500"
                                                        }`}
                                                    >
                                                        {process.cpu_percent}%
                                                    </span>
                                                </td>
                                                <td className='px-4 py-2'>
                                                    <span
                                                        className={`${
                                                            process.memory_mb >
                                                            1000
                                                                ? "text-red-500"
                                                                : "text-green-500"
                                                        }`}
                                                    >
                                                        {Math.round(
                                                            process.memory_mb
                                                        )}
                                                        MB
                                                    </span>
                                                </td>
                                                <td className='px-4 py-2 text-sm text-gray-500'>
                                                    {new Date(
                                                        process.create_time
                                                    ).toLocaleString()}
                                                </td>
                                                <td className='px-4 py-2'>
                                                    <span
                                                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                                                        ${
                                                            process.status ===
                                                            "running"
                                                                ? "bg-green-100 text-green-800"
                                                                : process.status ===
                                                                  "sleeping"
                                                                ? "bg-yellow-100 text-yellow-800"
                                                                : "bg-gray-100 text-gray-800"
                                                        }`}
                                                    >
                                                        {process.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}

                    {activeTab === "network" &&
                        (networkLoading ? (
                            <div className='flex items-center justify-center p-4'>
                                <FaSpinner className='animate-spin text-2xl text-blue-500' />
                            </div>
                        ) : (
                            <div className='overflow-x-auto'>
                                <div className='mb-4 flex justify-end'>
                                    <button
                                        onClick={loadNetworkActivities}
                                        disabled={
                                            networkLoading || !computer.online
                                        }
                                        className='flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300'
                                    >
                                        <FaSync
                                            className={
                                                networkLoading
                                                    ? "animate-spin"
                                                    : ""
                                            }
                                        />
                                        Refresh Network Activities
                                    </button>
                                </div>
                                <table className='min-w-full divide-y divide-gray-200'>
                                    <thead>
                                        <tr>
                                            <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-1/4'>
                                                <div className='flex items-center space-x-1'>
                                                    <FaTerminal />
                                                    <span>Process</span>
                                                </div>
                                            </th>
                                            <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20'>
                                                <div className='flex items-center space-x-1'>
                                                    <FaDesktop />
                                                    <span>PID</span>
                                                </div>
                                            </th>
                                            <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32'>
                                                <div className='flex items-center space-x-1'>
                                                    <FaUser />
                                                    <span>User</span>
                                                </div>
                                            </th>
                                            <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase'>
                                                <div className='flex items-center space-x-1'>
                                                    <FaGlobe />
                                                    <span>Remote Address</span>
                                                </div>
                                            </th>
                                            <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-40'>
                                                Remote Host
                                            </th>
                                            <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24'>
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className='divide-y divide-gray-200'>
                                        {networkActivities.map(
                                            (activity, idx) => (
                                                <tr key={idx}>
                                                    <td className='px-6 py-4 whitespace-nowrap'>
                                                        {activity.name}
                                                    </td>
                                                    <td className='px-6 py-4 whitespace-nowrap'>
                                                        {activity.pid}
                                                    </td>
                                                    <td className='px-6 py-4 whitespace-nowrap'>
                                                        {activity.username}
                                                    </td>
                                                    <td className='px-6 py-4 whitespace-nowrap'>
                                                        {activity.remote}
                                                    </td>
                                                    <td className='px-6 py-4 whitespace-nowrap'>
                                                        {activity.remote_host}
                                                    </td>
                                                    <td className='px-6 py-4 whitespace-nowrap'>
                                                        {activity.state}
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ))}

                    {activeTab === "applications" &&
                        (appsLoading ? (
                            <div className='flex items-center justify-center p-4'>
                                <FaSpinner className='animate-spin text-2xl text-blue-500' />
                            </div>
                        ) : (
                            <div>
                                <h3 className='text-lg font-medium mb-4'>
                                    Installed Applications
                                </h3>
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-8'>
                                    {applications.map((app) => (
                                        <div
                                            key={app.id}
                                            className='p-4 border rounded-lg'
                                        >
                                            <div className='flex justify-between items-start'>
                                                <div>
                                                    <h4 className='font-medium'>
                                                        {app.name}
                                                    </h4>
                                                    <p className='text-sm text-gray-500'>
                                                        Installed by:{" "}
                                                        {app.full_name}
                                                    </p>
                                                    <p className='text-sm text-gray-500'>
                                                        At:{" "}
                                                        {new Date(
                                                            app.installed_at
                                                        ).toLocaleString()}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() =>
                                                        handleUninstallApp(
                                                            app.id
                                                        )
                                                    }
                                                    disabled={uninstalling}
                                                    className={`px-3 py-1 rounded ${
                                                        uninstalling
                                                            ? "bg-gray-300"
                                                            : "bg-red-500 hover:bg-red-600"
                                                    } text-white`}
                                                >
                                                    {uninstalling ? (
                                                        <FaSpinner className='animate-spin' />
                                                    ) : (
                                                        <FaTrash />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <h3 className='text-lg font-medium mb-4'>
                                    Available Applications
                                </h3>
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                    {availableApps
                                        .filter(
                                            (app) =>
                                                !applications.find(
                                                    (installedApp) =>
                                                        installedApp.id ===
                                                        app.id
                                                )
                                        )
                                        .map((app) => (
                                            <div
                                                key={app.id}
                                                className='p-4 border rounded-lg'
                                            >
                                                <div className='flex justify-between items-start'>
                                                    <div>
                                                        <h4 className='font-medium'>
                                                            {app.name}
                                                        </h4>
                                                        <p className='text-sm text-gray-500'>
                                                            {app.description}
                                                        </p>
                                                        <p className='text-sm text-gray-500'>
                                                            Version:{" "}
                                                            {app.version}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            handleInstallApp(
                                                                app.id
                                                            )
                                                        }
                                                        disabled={installing}
                                                        className={`px-3 py-1 rounded ${
                                                            installing
                                                                ? "bg-gray-300"
                                                                : "bg-blue-500 hover:bg-blue-600"
                                                        } text-white`}
                                                    >
                                                        {installing ? (
                                                            <FaSpinner className='animate-spin' />
                                                        ) : (
                                                            <FaDownload />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        ))}

                    {activeTab === "files" &&
                        (filesLoading ? (
                            <div className='flex items-center justify-center p-4'>
                                <FaSpinner className='animate-spin text-2xl text-blue-500' />
                            </div>
                        ) : (
                            <div>
                                <h3 className='text-lg font-medium mb-4'>
                                    Installed Files
                                </h3>
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-8'>
                                    {files.map((file) => (
                                        <div
                                            key={file.id}
                                            className='p-4 border rounded-lg'
                                        >
                                            <div className='flex justify-between items-start'>
                                                <div>
                                                    <h4 className='font-medium'>
                                                        {file.name}
                                                    </h4>
                                                    <p className='text-sm text-gray-500'>
                                                        Installed by:{" "}
                                                        {file.full_name}
                                                    </p>
                                                    <p className='text-sm text-gray-500'>
                                                        At:{" "}
                                                        {new Date(
                                                            file.installed_at
                                                        ).toLocaleString()}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() =>
                                                        handleUninstallFile(
                                                            file.id
                                                        )
                                                    }
                                                    disabled={uninstalling}
                                                    className={`px-3 py-1 rounded ${
                                                        uninstalling
                                                            ? "bg-gray-300"
                                                            : "bg-red-500 hover:bg-red-600"
                                                    } text-white`}
                                                >
                                                    {uninstalling ? (
                                                        <FaSpinner className='animate-spin' />
                                                    ) : (
                                                        <FaTrash />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <h3 className='text-lg font-medium mb-4'>
                                    Available Files
                                </h3>
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                    {availableFiles
                                        .filter(
                                            (file) =>
                                                !files.find(
                                                    (installedFile) =>
                                                        installedFile.id ===
                                                        file.id
                                                )
                                        )
                                        .map((file) => (
                                            <div
                                                key={file.id}
                                                className='p-4 border rounded-lg'
                                            >
                                                <div className='flex justify-between items-start'>
                                                    <div>
                                                        <h4 className='font-medium'>
                                                            {file.name}
                                                        </h4>
                                                        <p className='text-sm text-gray-500'>
                                                            {file.description}
                                                        </p>
                                                        <p className='text-sm text-gray-500'>
                                                            Uploaded by: {file.full_name}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            handleInstallFile(
                                                                file.id
                                                            )
                                                        }
                                                        disabled={installing}
                                                        className={`px-3 py-1 rounded ${
                                                            installing
                                                                ? "bg-gray-300"
                                                                : "bg-blue-500 hover:bg-blue-600"
                                                        } text-white`}
                                                    >
                                                        {installing ? (
                                                            <FaSpinner className='animate-spin' />
                                                        ) : (
                                                            <FaDownload />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
};

export default ComputerDetails;
