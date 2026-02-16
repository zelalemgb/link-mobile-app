import React from "react";
import Toast from "../components/ui/Toast";

const ToastContext = React.createContext(null);

export const ToastProvider = ({ children }) => {
    const [toast, setToast] = React.useState(null);

    const showToast = (message, type = "success") => {
        setToast({ message, type });
    };

    const hideToast = () => {
        setToast(null);
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onHide={hideToast}
                />
            )}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const ctx = React.useContext(ToastContext);
    if (!ctx) {
        throw new Error("useToast must be used within ToastProvider");
    }
    return ctx;
};

export default ToastContext;
