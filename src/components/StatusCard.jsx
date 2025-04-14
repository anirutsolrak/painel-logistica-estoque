function StatusCard({ title, icon, data }) {
    try {
        return (
            <div data-name="status-card" className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center mb-4">
                    <i className={`${icon} text-xl mr-2 text-blue-600`}></i>
                    <h3 className="text-lg font-semibold">{title}</h3>
                </div>
                <div className="space-y-3">
                    {Object.entries(data).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center">
                            <span className="text-gray-600">{key}:</span>
                            <span className={`font-semibold ${typeof value === 'number' && value < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                {value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    } catch (error) {
        console.error('StatusCard component error:', error);
        reportError(error);
        return null;
    }
}
