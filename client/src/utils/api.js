import axios from 'axios';
import { update } from '../../../server/src/models/user.model';

const API_URL = 'http://localhost:3000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        // check is token valid not expired
        const time = new Date().getTime();
        const expireTime = localStorage.getItem('et');
        if (time > expireTime) {
            const refreshTokenExpireTime = localStorage.getItem('ret');
            if (time > refreshTokenExpireTime) {
                localStorage.clear();
                window.location.href = '/login';
            } else {
                // refresh token
                const refreshToken = localStorage.getItem('refreshToken');
                api.post('/user/auth/refresh', { refreshToken })
                    .then((res) => {
                        const { token, refreshToken } = res.data;
                        localStorage.setItem('token', token);
                        localStorage.setItem('refreshToken', refreshToken);
                        // set expire time after 15 minutes
                        const expireTime = new Date().getTime() + 15 * 60 * 1000;
                        localStorage.setItem('et', expireTime);
                        // set refresh token expire time after 7 days
                        const refreshTokenExpireTime = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
                        localStorage.setItem('ret', refreshTokenExpireTime);
                        config.headers.Authorization = `Bearer ${token}`;
                        return config;
                    })
                    .catch((err) => {
                        console.error(err);
                        localStorage.clear();
                        window.location.href = '/login';
                    });
            }
        }
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// auth endpoints
export const auth = {
    login: (data) => api.post('/user/auth/login', data)
        .then(res => {
            const { token, refreshToken, user } = res.data;
            if (!token || !refreshToken || !user) {
                return res;
            }
            localStorage.setItem('token', token);
            localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('user', JSON.stringify(user));
            const expireTime = new Date().getTime() + 15 * 60 * 1000;
            localStorage.setItem('et', expireTime);
            const refreshTokenExpireTime = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
            localStorage.setItem('ret', refreshTokenExpireTime);
            return res;
        }),
    logout: () => {
        localStorage.clear();
        window.location.href = '/login';
    }
};

export const users = {
    all: () => api.get('/user'),
    amount: () => api.get('/user/amount'),
    create: (data) => api.post('/user', data),// user = { fullname, username, email, password, role }
};

export const rooms = {
    all: () => api.get('/room'),
    amount: () => api.get('/room/amount'),
    // room = { name, description }
    create: (data) => api.post('/room', data),
    update: (data) => api.put('/room', data),
    delete: (id) => api.delete(`/room/${id}`),

    // computer
    getComputers: (id) => api.get(`/room/${id}/computers`),
    amountComputers: (id) => api.get(`/room/${id}/amount_computers`),
    // application = { room_id, application_id, user_id }
    getComputersInstalled: (data) => api.get('/room/applications', data),
    installApplication: (data) => api.post('/room/applications', data),

    // user = { room_id, user_id }
    getUsers: (id) => api.get(`/room/${id}/users`),
    addUser: (data) => api.post('/room/users', data),
    removeUser: (data) => api.delete('/room/users', data),
};

export const computers = {
    all: () => api.get('/computer'),
    amount: () => api.get('/computer/amount'),
    delete: (id) => api.delete(`/computer/${id}`),

    getProcesses: (id) => api.get(`/computer/${id}/processes`),
    getNetActivities: (id) => api.get(`/computer/${id}/network`),
    getApplications: (id) => api.get(`/computer/${id}/applications`),
    // application = { id, application_id }
    installApplication: (data) => api.post(`/computer/${data.id}/applications`, data),
};

export default api;