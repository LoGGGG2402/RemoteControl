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
                    const res = await api.post("/user/auth/refresh", {
                        refreshToken,
                    });

                    const {
                        token,
                        refreshToken: newRefreshToken,
                        expireTime,
                        refreshTokenExpireTime,
                    } = res.data;

                    localStorage.setItem("token", token);
                    localStorage.setItem("refreshToken", newRefreshToken);
                    localStorage.setItem("ret", refreshTokenExpireTime);
                    localStorage.setItem("et", expireTime);

                    config.headers.Authorization = `Bearer ${token}`;

                    // Resolve pending requests
                    refreshSubscribers.forEach((cb) => cb(token));
                    refreshSubscribers = [];

                    return config;
                } catch (err) {
                    localStorage.clear();
                    window.location.href = "/login";
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

            const res = await api.post("/user/auth/login", data);
            console.log("Login response received:", res);

            const {
                token,
                refreshToken,
                user,
                expireTime,
                refreshTokenExpireTime,
            } = res.data;

            if (!token || !refreshToken || !user) {
                console.warn("Missing required fields in response:", res.data);
                return res;
            }

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
    create: (data) => api.post("/user", data), // user = { fullname, username, email, password, role }
};

export const rooms = {
    all: () => api.get("/room"),
    amount: () => api.get("/room/amount"),
    // room = { name, description }
    create: (data) => api.post("/room", data),
    update: (data) => api.put(`/room/${data.id}`, data),
    delete: (id) => api.delete(`/room/${id}`),

    // computer
    getComputers: (id) => api.get(`/room/${id}/computers`),
    amountComputers: (id) => api.get(`/room/${id}/amount_computers`),
    // application = { room_id, application_id, user_id }
    getComputersInstalled: (data) => api.get("/room/applications", data),
    installApplication: (data) => api.post("/room/applications", data),

    // user = { room_id, user_id }
    getUsers: (id) => api.get(`/room/${id}/users`),
    addUser: (data) => api.post("/room/users", data),
    removeUser: (data) => api.delete("/room/users", data),
};

export const computers = {
    all: () => api.get("/computer"),
    amount: () => api.get("/computer/amount"),
    delete: (id) => api.delete(`/computer/${id}`),

    getProcesses: (id) => api.get(`/computer/${id}/processes`),
    getNetActivities: (id) => api.get(`/computer/${id}/network`),
    getApplications: (id) => api.get(`/computer/${id}/applications`),
    // application = { id, application_id }
    installApplication: (data) =>
        api.post(`/computer/${data.id}/applications`, data),
};

export default api;
