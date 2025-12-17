let eventSource = null;
let isMonitoring = false;

// DOM Elements
const startBtn = document.getElementById('startBtn');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');
const logsContainer = document.getElementById('logs');
const clearLogsBtn = document.getElementById('clearLogs');

// Format timestamp
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false });
}

// Add log entry to UI
function addLog(message, type = 'info', timestamp = new Date().toISOString()) {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    
    const icon = {
        info: 'ℹ️',
        success: '✅',
        error: '❌',
        warning: '⚠️'
    }[type] || 'ℹ️';
    
    logEntry.innerHTML = `
        <span class="log-icon">${icon}</span>
        <span class="log-time">${formatTime(timestamp)}</span>
        <span class="log-message">${message}</span>
    `;
    
    logsContainer.appendChild(logEntry);
    
    // Auto-scroll to bottom
    logsContainer.scrollTop = logsContainer.scrollHeight;
    
    // Limit to 100 logs
    if (logsContainer.children.length > 100) {
        logsContainer.removeChild(logsContainer.firstChild);
    }
}

// Connect to SSE for real-time logs
function connectToLogs() {
    if (eventSource) {
        eventSource.close();
    }
    
    eventSource = new EventSource('/api/logs');
    
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        addLog(data.message, data.type, data.timestamp);
    };
    
    eventSource.onerror = (error) => {
        console.error('SSE Error:', error);
        if (isMonitoring) {
            addLog('Connection lost. Reconnecting...', 'warning');
            setTimeout(connectToLogs, 3000);
        }
    };
}

// Start monitoring
async function startMonitoring() {
    if (isMonitoring) return;
    
    isMonitoring = true;
    startBtn.disabled = true;
    startBtn.classList.add('active');
    startBtn.innerHTML = `
        <span class="btn-icon">⏸️</span>
        <span class="btn-text">MONITORING...</span>
    `;
    
    statusDot.classList.add('active');
    statusText.textContent = 'Monitoring active';
    
    // Clear old logs
    logsContainer.innerHTML = '';
    
    // Connect to log stream
    connectToLogs();
    
    // Trigger start processing
    try {
        const response = await fetch('/api/start', {
            method: 'POST'
        });
        const data = await response.json();
        
        if (!response.ok) {
            addLog(`Error: ${data.error || 'Failed to start'}`, 'error');
        }
    } catch (error) {
        addLog(`Error: ${error.message}`, 'error');
    }
}

// Stop monitoring
function stopMonitoring() {
    if (!isMonitoring) return;
    
    isMonitoring = false;
    
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    
    startBtn.disabled = false;
    startBtn.classList.remove('active');
    startBtn.innerHTML = `
        <span class="btn-icon">▶️</span>
        <span class="btn-text">START MONITORING</span>
    `;
    
    statusDot.classList.remove('active');
    statusText.textContent = 'Monitoring stopped';
    
    addLog('Monitoring stopped by user', 'warning');
}

// Clear logs
function clearLogs() {
    logsContainer.innerHTML = '';
    addLog('Logs cleared', 'info');
}

// Event listeners
startBtn.addEventListener('click', () => {
    if (isMonitoring) {
        stopMonitoring();
    } else {
        startMonitoring();
    }
});

clearLogsBtn.addEventListener('click', clearLogs);

// Initial connection
addLog('Ready to start. Click START MONITORING button.', 'info');
