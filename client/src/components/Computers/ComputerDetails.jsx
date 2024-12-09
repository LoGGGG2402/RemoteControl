import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { computers, applications as appsApi } from "../../utils/api";
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
} from "react-icons/fa";

const ComputerDetails = () => {
    const { id } = useParams();
    const [computer, setComputer] = useState(null);
    const [processes, setProcesses] = useState([]);
    const [networkActivities, setNetworkActivities] = useState([]);
    const [applications, setApplications] = useState([]);
    const [availableApps, setAvailableApps] = useState([]);
    const [activeTab, setActiveTab] = useState("applications"); // Changed default tab
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [installing, setInstalling] = useState(false);
    const [installError, setInstallError] = useState(null);
    const [processesLoading, setProcessesLoading] = useState(false);
    const [networkLoading, setNetworkLoading] = useState(false);
    const [appsLoading, setAppsLoading] = useState(false);
    const [uninstalling, setUninstalling] = useState(false);
    const [uninstallError, setUninstallError] = useState(null);
    const [editing, setEditing] = useState(false);
    const [editNotes, setEditNotes] = useState("");
    const [editErrors, setEditErrors] = useState("");
    const [updateError, setUpdateError] = useState(null);

    useEffect(() => {
        const init = async () => {
            await loadComputerData();
            await loadApplicationsData(); // Load applications data on mount
        };
        init();
    }, [id]);

    useEffect(() => {
        if (computer) {
            setEditNotes(computer.notes || "");
            setEditErrors(computer.errors || "");
        }
    }, [computer]);

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
            setProcesses(res.data.processList.processes || []);
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
            setNetworkActivities(res.data.networkConnections.connections || []);
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

    const handleUpdateNotesAndErrors = async () => {
        try {
            await computers.updateNotesAndErrors(id, {
                notes: editNotes,
                errors: editErrors,
            });
            await loadComputerData(); // Refresh computer data
            setEditing(false);
            setUpdateError(null);
        } catch (err) {
            setUpdateError(err.response?.data || "Failed to update notes and errors");
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
                                        <label className='block text-sm font-medium text-gray-700'>Notes</label>
                                        <textarea
                                            value={editNotes}
                                            onChange={(e) => setEditNotes(e.target.value)}
                                            className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
                                            rows={3}
                                            placeholder="Add notes about this computer..."
                                        />
                                    </div>
                                    <div>
                                        <label className='block text-sm font-medium text-gray-700'>Errors</label>
                                        <textarea
                                            value={editErrors}
                                            onChange={(e) => setEditErrors(e.target.value)}
                                            className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
                                            rows={3}
                                            placeholder="Record any errors..."
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
                                                Notes & Issues
                                            </h3>
                                            <button
                                                onClick={() => setEditing(true)}
                                                className='px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 flex items-center gap-1'
                                            >
                                                <FaEdit />
                                                Edit
                                            </button>
                                        </div>
                                        <div className='space-y-4'>
                                            <div className='bg-gray-50 p-4 rounded-lg'>
                                                <h4 className='text-sm font-medium text-gray-700 mb-2'>Notes</h4>
                                                {computer.notes ? (
                                                    <p className='text-gray-600 whitespace-pre-line'>{computer.notes}</p>
                                                ) : (
                                                    <p className='text-gray-400 italic'>No notes added</p>
                                                )}
                                            </div>
                                            
                                            {computer.errors && (
                                                <div className='bg-red-50 p-4 rounded-lg border border-red-200'>
                                                    <h4 className='text-sm font-medium text-red-700 mb-2 flex items-center gap-2'>
                                                        <FaExclamationTriangle />
                                                        Reported Errors
                                                    </h4>
                                                    <p className='text-red-600 whitespace-pre-line'>{computer.errors}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {updateError && (
                                        <div className='text-red-500 text-sm flex items-center gap-1'>
                                            <FaExclamationTriangle />
                                            {updateError}
                                        </div>
                                    )}
                                </div>
                            )}
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

            <div className='bg-white rounded-lg shadow-md'>
                <div className='border-b'>
                    <nav className='flex'>
                        {["applications", "processes", "network"].map((tab) => (
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
                    {activeTab === "processes" && (
                        processesLoading ? (
                            <div className='flex items-center justify-center p-4'>
                                <FaSpinner className='animate-spin text-2xl text-blue-500' />
                            </div>
                        ) : (
                            <div className='overflow-x-auto'>
                                <div className='mb-4 flex justify-end'>
                                    <button
                                        onClick={loadProcesses}
                                        disabled={processesLoading || !computer.online}
                                        className='flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300'
                                    >
                                        <FaSync className={processesLoading ? 'animate-spin' : ''} />
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
                        )
                    )}

                    {activeTab === "network" && (
                        networkLoading ? (
                            <div className='flex items-center justify-center p-4'>
                                <FaSpinner className='animate-spin text-2xl text-blue-500' />
                            </div>
                        ) : (
                            <div className='overflow-x-auto'>
                                <div className='mb-4 flex justify-end'>
                                    <button
                                        onClick={loadNetworkActivities}
                                        disabled={networkLoading || !computer.online}
                                        className='flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300'
                                    >
                                        <FaSync className={networkLoading ? 'animate-spin' : ''} />
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
                        )
                    )}

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
                </div>
            </div>
        </div>
    );
};

export default ComputerDetails;
