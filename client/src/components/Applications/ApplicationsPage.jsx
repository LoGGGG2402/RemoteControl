import React, { useState, useEffect } from 'react';
import { applications } from '../../utils/api';

function ApplicationsPage({ user }) {
    const [apps, setApps] = useState([]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [version, setVersion] = useState('');
    const [error, setError] = useState(null);
    const [editingApp, setEditingApp] = useState(null);
    const [editDescription, setEditDescription] = useState('');
    const [editVersion, setEditVersion] = useState('');

    useEffect(() => {
        loadApplications();
    }, []);

    const loadApplications = async () => {
        try {
            const response = await applications.all();
            setApps(response.data);
            setError(null);
        } catch (err) {
            setError(err.response?.data || 'Failed to load applications');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await applications.create({ name, description, version });
            setName('');
            setDescription('');
            setVersion('');
            setError(null);
            loadApplications();
        } catch (err) {
            setError(err.response?.data || 'Failed to create application');
        }
    };

    const handleDelete = async (id) => {
        try {
            await applications.delete(id);
            setError(null);
            loadApplications();
        } catch (err) {
            setError(err.response?.data || 'Failed to delete application');
        }
    };

    const handleEdit = (app) => {
        setEditingApp(app);
        setEditDescription(app.description || '');
        setEditVersion(app.version || '');
    };

    const handleUpdate = async () => {
        try {
            await applications.update(editingApp.id, {
                description: editDescription,
                version: editVersion
            });
            setEditingApp(null);
            setError(null);
            loadApplications();
        } catch (err) {
            setError(err.response?.data || 'Failed to update application');
        }
    };

    return (
        <div className="container mx-auto px-6 py-8">
            <h1 className="text-3xl font-semibold text-gray-800 mb-6">Applications</h1>
            
            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded shadow">
                    <p className="font-medium">Error</p>
                    <p>{error}</p>
                </div>
            )}
            
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">Add New Application</h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input
                        type="text"
                        placeholder="Application Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:border-blue-500"
                        required
                    />
                    <input
                        type="text"
                        placeholder="Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:border-blue-500"
                    />
                    <input
                        type="text"
                        placeholder="Version"
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:border-blue-500"
                    />
                    <button 
                        type="submit" 
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition duration-200"
                    >
                        Add Application
                    </button>
                </form>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {apps.map(app => (
                            <tr key={app.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {app.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {editingApp?.id === app.id ? (
                                        <input
                                            type="text"
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                            className="w-full px-2 py-1 border rounded"
                                        />
                                    ) : app.description}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {editingApp?.id === app.id ? (
                                        <input
                                            type="text"
                                            value={editVersion}
                                            onChange={(e) => setEditVersion(e.target.value)}
                                            className="w-full px-2 py-1 border rounded"
                                        />
                                    ) : app.version}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    {editingApp?.id === app.id ? (
                                        <>
                                            <button
                                                onClick={handleUpdate}
                                                className="text-green-600 hover:text-green-900 font-medium transition duration-200"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingApp(null)}
                                                className="text-gray-600 hover:text-gray-900 font-medium transition duration-200"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleEdit(app)}
                                                className="text-blue-600 hover:text-blue-900 font-medium transition duration-200 mr-2"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(app.id)}
                                                className="text-red-600 hover:text-red-900 font-medium transition duration-200"
                                            >
                                                Delete
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default ApplicationsPage;