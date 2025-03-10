document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const loginContainer = document.getElementById('login-container');
    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesEl = document.getElementById('messages');
    const studentLoginBtn = document.getElementById('student-login-btn');
    const studentIdInput = document.getElementById('student-id');
    const studentNameInput = document.getElementById('student-name');
    const studentEmailInput = document.getElementById('student-email');
    const studentDisplayName = document.getElementById('student-display-name');
    const shopkeeperName = document.getElementById('shopkeeper-name');
    const shopkeeperStatus = document.getElementById('shopkeeper-status');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Connect to the server
    const socket = io('http://localhost:5000');
    
    // User data
    let userData = {
        userId: '',
        name: '',
        userType: 'student',
        email: ''
    };
    
    let shopkeeper = {
        userId: 'shopkeeper',
        name: 'Shop',
        online: false
    };
    
    // Student login
    studentLoginBtn.addEventListener('click', async () => {
        const studentId = studentIdInput.value.trim();
        const name = studentNameInput.value.trim();
        const email = studentEmailInput.value.trim();
        
        if (!studentId || !name) {
            alert('Please enter both student ID and name');
            return;
        }
        
        userData = {
            userId: studentId,
            name,
            userType: 'student',
            email
        };
        
        try {
            // Register/login user
            const response = await fetch('http://localhost:5000/api/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            if (!response.ok) {
                throw new Error('Login failed');
            }
            
            // Get shopkeeper info
            const shopkeeperResponse = await fetch('http://localhost:5000/api/users/type/shopkeeper');
            if (shopkeeperResponse.ok) {
                const shopkeeperData = await shopkeeperResponse.json();
                if (shopkeeperData) {
                    shopkeeper = {
                        userId: shopkeeperData.userId,
                        name: shopkeeperData.name
                    };
                    shopkeeperName.textContent = shopkeeper.name;
                }
            }
            
            // Update UI
            studentDisplayName.textContent = `Logged in as: ${name}`;
            
            // Hide login and show chat
            loginContainer.style.display = 'none';
            chatContainer.style.display = 'flex';
            
            // Connect to socket
            socket.emit('login', {
                userId: studentId,
                userType: 'student'
            });
            
            // Load conversation history
            loadConversation();
            
            // Focus input
            messageInput.focus();
        } catch (error) {
            console.error('Error during login:', error);
            alert('Login failed. Please try again.');
        }
    });
    
    // Send message
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;
        
        const messageData = {
            text,
            sender: userData.userId,
            recipient: shopkeeper.userId,
            timestamp: new Date()
        };
        
        // Send the message
        socket.emit('sendDirectMessage', messageData);
        
        // Clear input
        messageInput.value = '';
        messageInput.focus();
    }
    
    // Listen for incoming messages
    socket.on('directMessage', (message) => {
        if ((message.sender === userData.userId && message.recipient === shopkeeper.userId) ||
            (message.sender === shopkeeper.userId && message.recipient === userData.userId)) {
            addMessageToDOM(message);
            
            // Scroll to bottom
            messagesEl.scrollTop = messagesEl.scrollHeight;
            
            // Mark messages as read if they're from shopkeeper
            if (message.sender === shopkeeper.userId) {
                markMessagesAsRead(shopkeeper.userId, userData.userId);
            }
        }
    });
    // Listen for shopkeeper online status
    socket.on('shopkeeperStatus', (status) => {
        shopkeeper.online = status.online;
        updateShopkeeperStatus();
    });
    
    function updateShopkeeperStatus() {
        shopkeeperStatus.textContent = shopkeeper.online ? 'Online' : 'Offline';
        shopkeeperStatus.className = shopkeeper.online ? 'status-online' : 'status-offline';
    }
    
    // Load conversation history
    async function loadConversation() {
        try {
            const response = await fetch(`http://localhost:5000/api/messages/between/${userData.userId}/${shopkeeper.userId}`);
            if (response.ok) {
                const messages = await response.json();
                
                // Clear existing messages
                messagesEl.innerHTML = '';
                
                // Add messages to DOM
                messages.forEach(message => {
                    addMessageToDOM(message);
                });
                
                // Scroll to bottom
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }
        } catch (error) {
            console.error('Error loading conversation:', error);
        }
    }
    
    // Add a message to the DOM
    function addMessageToDOM(message) {
        const messageEl = document.createElement('div');
        messageEl.className = message.sender === userData.userId ? 'message sent' : 'message received';
        
        const timestamp = new Date(message.timestamp);
        const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageEl.innerHTML = `
            <div class="message-content">
                <p>${message.text}</p>
                <span class="message-time">${timeString}</span>
            </div>
        `;
        
        messagesEl.appendChild(messageEl);
    }
    
    // Mark messages as read
    async function markMessagesAsRead(sender, recipient) {
        try {
            await fetch('http://localhost:5000/api/messages/markRead', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sender, recipient })
            });
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    }
    
    // Logout functionality
    logoutBtn.addEventListener('click', () => {
        socket.emit('logout', { userId: userData.userId });
        
        // Reset UI
        loginContainer.style.display = 'block';
        chatContainer.style.display = 'none';
        messagesEl.innerHTML = '';
        studentIdInput.value = '';
        studentNameInput.value = '';
        studentEmailInput.value = '';
    });
    
    // Check shopkeeper status on initial load
    socket.on('connect', () => {
        socket.emit('getShopkeeperStatus');
    });
    
    // Handle connection errors
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        alert('Unable to connect to the server. Please try again later.');
    });
    
    // Handle typing indicators (optional feature)
    let typingTimeout;
    
    messageInput.addEventListener('input', () => {
        if (!typingTimeout) {
            socket.emit('typing', {
                sender: userData.userId,
                recipient: shopkeeper.userId,
                isTyping: true
            });
        }
        
        clearTimeout(typingTimeout);
        
        typingTimeout = setTimeout(() => {
            socket.emit('typing', {
                sender: userData.userId,
                recipient: shopkeeper.userId,
                isTyping: false
            });
            typingTimeout = null;
        }, 1000);
    });
    
    socket.on('typing', (data) => {
        if (data.sender === shopkeeper.userId && data.recipient === userData.userId) {
            const typingIndicator = document.getElementById('typing-indicator');
            if (data.isTyping) {
                typingIndicator.textContent = 'Shopkeeper is typing...';
                typingIndicator.style.display = 'block';
            } else {
                typingIndicator.style.display = 'none';
            }
        }
    });
});