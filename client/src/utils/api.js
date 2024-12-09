import axios from "axios";

const API_URL = "http://localhost:3000/api";

const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

let isRefreshing = false;
let refreshSubscribers = [];

api.interceptors.request.use(
    async (config) => {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "/login";
            return config;
        }

        const time = new Date().getTime();
        const et = localStorage.getItem("et");

        if (time > et) {
            const ret = localStorage.getItem("ret");
            if (time > ret) {
                localStorage.clear();
                window.location.href = "/login";
                return Promise.reject("Session expired");
            }

            // Prevent multiple refresh requests
            if (!isRefreshing) {
                isRefreshing = true;

                try {
                    const refreshToken = localStorage.getItem("refreshToken");
                    const res = await axios.post(`${API_URL}/auth/refresh`, {
                        refreshToken,
                    });

                    const {
                        newToken,
                        newRefreshToken,
                        newExpireTime, // 1 minute
                        newRefreshTokenExpireTime,
                    } = res.data;

                    localStorage.setItem("token", newToken);
                    localStorage.setItem("refreshToken", newRefreshToken);
                    localStorage.setItem("ret", newRefreshTokenExpireTime);
                    localStorage.setItem("et", newExpireTime);

                    config.headers.Authorization = `Bearer ${newToken}`;

                    // Use newToken instead of old token for pending requests
                    refreshSubscribers.forEach((cb) => cb(newToken));
                    refreshSubscribers = [];

                    return config;
                } catch (err) {
                    localStorage.clear();
                    window.location.href = "/login";
                    console.error("Failed to refresh token:", err);
                    return Promise.reject(err);
                } finally {
                    isRefreshing = false;
                }
            }

            // Queue requests while refreshing
            return new Promise((resolve) => {
                refreshSubscribers.push((token) => {
                    config.headers.Authorization = `Bearer ${token}`;
                    resolve(config);
                });
            });
        }

        config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// auth endpoints
export const auth = {
    login: async (data) => {
        try {
            console.log("Sending login request with data:", data);

            const res = await axios.post(`${API_URL}/auth/login`, data, {
                headers: {
                    "Content-Type": "application/json",
                },
            });
            console.log("Login response received:", res);

            const {
                token,
                refreshToken,
                user,
                expireTime,
                refreshTokenExpireTime,
            } = res.data;

            localStorage.setItem("token", token);
            localStorage.setItem("refreshToken", refreshToken);
            localStorage.setItem("user", JSON.stringify(user));
            localStorage.setItem("et", expireTime);
            localStorage.setItem("ret", refreshTokenExpireTime);

            return res;
        } catch (error) {
            console.error("Login error:", {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
            });
            throw error;
        }
    },
    logout: () => {
        localStorage.clear();
        window.location.href = "/login";
    },
};

export const users = {
    all: () => api.get("/user"),
    amount: () => api.get("/user/amount"),
    create: (data) => api.post("/user", data),
};

export const rooms = {
    all: () => api.get("/room"),
    amount: () => api.get("/room/amount"),

    // room
    get: (id) => api.get(`/room/${id}`),
    create: (data) => api.post("/room", data),
    update: (data) => api.put(`/room/${data.id}`, data),
    delete: (id) => api.delete(`/room/${id}`),

    // computer
    amountComputers: (id) => api.get(`/room/${id}/amount_computers`),

    // application
    getComputersInstalled: (data) => api.get("/room/applications", data),
    installApplication: (data) => api.post("/room/applications", data),

    // user
    getUsers: (id) => api.get(`/room/${id}/users`),
    addUser: (data) => api.post("/room/users", data),
    removeUser: (data) =>
        api.delete(`/room/${data.room_id}/users`, {
            data: { user_id: data.user_id },
        }),
};

export const computers = {
    all: () => api.get("/computer"),
    amount: () => api.get("/computer/amount"),

    // computer
    get: (id) => api.get(`/computer/${id}`),
    delete: (id) => api.delete(`/computer/${id}`),

    // monitor
    getProcesses: (id) => api.get(`/computer/${id}/processes`),
    getNetActivities: (id) => api.get(`/computer/${id}/network`),
    getApplications: (id) => api.get(`/computer/${id}/applications`),

    // manage
    installApplication: (data) =>
        api.post(`/computer/${data.id}/applications`, data),
};

export const applications = {
    all: () => api.get("/application"),
    create: (data) => api.post("/application", data),
    delete: (id) => api.delete(`/application/${id}`),
    update: (id, data) => api.put(`/application/${id}`, data),
};

export default api;
