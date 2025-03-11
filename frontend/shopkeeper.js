document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const loginContainer = document.getElementById('login-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesEl = document.getElementById('messages');
    const shopkeeperLoginBtn = document.getElementById('shopkeeper-login-btn');
    const shopkeeperIdInput = document.getElementById('shopkeeper-id');
    const shopkeeperNameInput = document.getElementById('shopkeeper-name-input');
    const shopDisplayName = document.getElementById('shop-display-name');
    const studentsList = document.getElementById('students-list');
    const selectedStudent = document.getElementById('selected-student');
    const searchInput = document.getElementById('search-input');
    const shopkeeperLogoutBtn = document.getElementById('shopkeeper-logout-btn');
    
    // Connect to the server
    const socket = io('http://localhost:5000');
    
    // Shopkeeper data
    let shopkeeperData = {
        userId: 'shopkeeper',
        name: '',
        userType: 'shopkeeper'
    };
    
    // Store for active students
    let students = [];
    let currentStudent = null;
    let unreadMessageCounts = {};
    
    // Shopkeeper login
    shopkeeperLoginBtn.addEventListener('click', async () => {
        const shopkeeperId = shopkeeperIdInput.value.trim();
        const name = shopkeeperNameInput.value.trim();
        
        if (!shopkeeperId || !name) {
            alert('Please enter both shopkeeper ID and shop name');
            return;
        }
        
        shopkeeperData = {
            userId: shopkeeperId,
            name,
            userType: 'shopkeeper'
        };
        
        try {
            // Register/login shopkeeper
            const response = await fetch('http://localhost:5000/api/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(shopkeeperData)
            });
            
            if (!response.ok) {
                throw new Error('Login failed');
            }
            
            // Update UI
            shopDisplayName.textContent = `Logged in as: ${name}`;
            
            // Hide login and show dashboard
            loginContainer.style.display = 'none';
            dashboardContainer.style.display = 'flex';
            
            // Connect to socket
            socket.emit('login', {
                userId: shopkeeperId,
                userType: 'shopkeeper'
            });
            
            // Load students list
            loadStudents();
            
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
        if (!text || !currentStudent) return;
        
        const messageData = {
            text,
            sender: shopkeeperData.userId,
            recipient: currentStudent.userId,
            timestamp: new Date()
        };
        
        // Send the message
        socket.emit('sendDirectMessage', messageData);
        
        // Clear input
        messageInput.value = '';
        messageInput.focus();
    }
    
    // Listen for incoming messages
    // Fixed code for shopkeeper.js
socket.on('directMessage', (message) => {
    // Check if message belongs to current conversation
    if (currentStudent && 
        ((message.sender === shopkeeperData.userId && message.recipient === currentStudent.userId) ||
         (message.sender === currentStudent.userId && message.recipient === shopkeeperData.userId))) {
        
        addMessageToDOM(message);
        
        // Scroll to bottom
        messagesEl.scrollTop = messagesEl.scrollHeight;
        
        // Mark messages as read if they're from current student
        if (message.sender === currentStudent.userId) {
            markMessagesAsRead(currentStudent.userId, shopkeeperData.userId);
            // Reset unread count for this student
            unreadMessageCounts[currentStudent.userId] = 0;
            updateStudentListItem(currentStudent);
        }
    } 
    // If message is from a student not currently selected
    else if (message.sender !== shopkeeperData.userId && message.recipient === shopkeeperData.userId) {
        // Increment unread count
        if (!unreadMessageCounts[message.sender]) {
            unreadMessageCounts[message.sender] = 0;
        }
        unreadMessageCounts[message.sender]++;
        
        // Find or add the student
        const existingStudent = students.find(s => s.userId === message.sender);
        if (existingStudent) {
            updateStudentListItem(existingStudent);
        } else {
            loadStudents(); // Reload to get new student
        }
    }
    // If message is from shopkeeper to a student who is not currently selected
    else if (message.sender === shopkeeperData.userId && currentStudent && message.recipient !== currentStudent.userId) {
        // Do nothing - don't add to current conversation
        return;
    }
});
    
    // Load students who have sent messages
    async function loadStudents() {
        try {
            const response = await fetch(`http://localhost:5000/api/users/type/student`);
            if (response.ok) {
                const studentData = await response.json();
                students = studentData;
                
                // Get unread message counts
                await getUnreadMessageCounts();
                
                // Render student list
                renderStudentList();
            }
        } catch (error) {
            console.error('Error loading students:', error);
        }
    }
    
    // Get unread message counts for all students
    async function getUnreadMessageCounts() {
        try {
            const response = await fetch(`http://localhost:5000/api/messages/unread/${shopkeeperData.userId}`);
            if (response.ok) {
                const counts = await response.json();
                unreadMessageCounts = counts;
            }
        } catch (error) {
            console.error('Error getting unread counts:', error);
        }
    }
    
    // Render the list of students
    function renderStudentList() {
        // Clear existing list
        studentsList.innerHTML = '';
        
        if (students.length === 0) {
            studentsList.innerHTML = '<div class="empty-list-message">No students have contacted you yet.</div>';
            return;
        }
        
        // Sort students: those with unread messages first, then alphabetically
        students.sort((a, b) => {
            const unreadA = unreadMessageCounts[a.userId] || 0;
            const unreadB = unreadMessageCounts[b.userId] || 0;
            
            if (unreadA > 0 && unreadB === 0) return -1;
            if (unreadA === 0 && unreadB > 0) return 1;
            return a.name.localeCompare(b.name);
        });
        
        // Add each student to the list
        students.forEach(student => {
            addStudentToList(student);
        });
    }
    
    // Add a single student to the list
    function addStudentToList(student) {
        const studentEl = document.createElement('div');
        studentEl.className = 'student-item';
        studentEl.dataset.userId = student.userId;
        
        const unreadCount = unreadMessageCounts[student.userId] || 0;
        const unreadBadge = unreadCount > 0 ? 
            `<span class="unread-badge">${unreadCount}</span>` : '';
        
        studentEl.innerHTML = `
            <div class="student-info">
                <i class="fas fa-user"></i>
                <div class="student-details">
                    <span class="student-name">${student.name}</span>
                    <span class="student-id">${student.userId}</span>
                </div>
            </div>
            ${unreadBadge}
        `;
        
        studentEl.addEventListener('click', () => {
            selectStudent(student);
        });
        
        studentsList.appendChild(studentEl);
    }
    
    // Update an existing student list item
    function updateStudentListItem(student) {
        const studentEl = document.querySelector(`.student-item[data-user-id="${student.userId}"]`);
        if (!studentEl) return;
        
        const unreadCount = unreadMessageCounts[student.userId] || 0;
        const unreadBadge = studentEl.querySelector('.unread-badge');
        
        if (unreadCount > 0) {
            if (unreadBadge) {
                unreadBadge.textContent = unreadCount;
            } else {
                const badge = document.createElement('span');
                badge.className = 'unread-badge';
                badge.textContent = unreadCount;
                studentEl.appendChild(badge);
            }
        } else if (unreadBadge) {
            unreadBadge.remove();
        }
    }
    
    // Select a student to chat with
    function selectStudent(student) {
        currentStudent = student;
        
        // Update UI
        document.querySelectorAll('.student-item').forEach(el => {
            el.classList.remove('active');
        });
        
        const studentEl = document.querySelector(`.student-item[data-user-id="${student.userId}"]`);
        if (studentEl) {
            studentEl.classList.add('active');
        }
        
        // Update selected student display
        selectedStudent.innerHTML = `
            <i class="fas fa-user"></i>
            <span>${student.name} (${student.userId})</span>
        `;
        
        // Enable input
        messageInput.disabled = false;
        sendBtn.disabled = false;
        
        // Load conversation
        loadConversation(student.userId);
        
        // Mark messages as read
        markMessagesAsRead(student.userId, shopkeeperData.userId);
        
        // Reset unread count
        unreadMessageCounts[student.userId] = 0;
        updateStudentListItem(student);
        
        // Focus input
        messageInput.focus();
    }
    
    // Load conversation with a specific student
    async function loadConversation(studentId) {
        try {
            const response = await fetch(`http://localhost:5000/api/messages/between/${shopkeeperData.userId}/${studentId}`);
            if (response.ok) {
                const messages = await response.json();
                
                // Clear existing messages
                messagesEl.innerHTML = '';
                
                if (messages.length === 0) {
                    messagesEl.innerHTML = '<div class="welcome-message"><p>No messages yet with this student.</p></div>';
                } else {
                    // Add messages to DOM
                    messages.forEach(message => {
                        addMessageToDOM(message);
                    });
                }
                
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
        messageEl.className = message.sender === shopkeeperData.userId ? 'message sent' : 'message received';
        
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
    
    // Search functionality
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.trim().toLowerCase();
        
        document.querySelectorAll('.student-item').forEach(studentEl => {
            const studentName = studentEl.querySelector('.student-name').textContent.toLowerCase();
            const studentId = studentEl.querySelector('.student-id').textContent.toLowerCase();
            
            if (studentName.includes(searchTerm) || studentId.includes(searchTerm)) {
                studentEl.style.display = 'flex';
            } else {
                studentEl.style.display = 'none';
            }
        });
    });
    
    // Logout functionality
    shopkeeperLogoutBtn.addEventListener('click', () => {
        socket.emit('logout', { userId: shopkeeperData.userId });
        
        // Reset UI
        loginContainer.style.display = 'block';
        dashboardContainer.style.display = 'none';
        messagesEl.innerHTML = '';
        studentsList.innerHTML = '';
        shopkeeperNameInput.value = '';
        currentStudent = null;
        students = [];
    });
    
    // Notify server that shopkeeper is online
    socket.on('connect', () => {
        if (shopkeeperData.userId) {
            socket.emit('shopkeeperOnline', { online: true });
        }
    });
    
    // Handle connection errors
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        alert('Unable to connect to the server. Please try again later.');
    });
    
    // Student comes online notification
    socket.on('studentOnline', (data) => {
        const student = students.find(s => s.userId === data.userId);
        if (student) {
            // You could update UI to show student is online
            // For example, add an "online" indicator to the student list item
            const studentEl = document.querySelector(`.student-item[data-user-id="${student.userId}"]`);
            if (studentEl) {
                const statusIndicator = document.createElement('span');
                statusIndicator.className = 'status-indicator online';
                studentEl.querySelector('.student-info').appendChild(statusIndicator);
            }
        }
    });
    
    // Handle typing indicators
    let typingTimeout;
    
    messageInput.addEventListener('input', () => {
        if (!currentStudent) return;
        
        if (!typingTimeout) {
            socket.emit('typing', {
                sender: shopkeeperData.userId,
                recipient: currentStudent.userId,
                isTyping: true
            });
        }
        
        clearTimeout(typingTimeout);
        
        typingTimeout = setTimeout(() => {
            socket.emit('typing', {
                sender: shopkeeperData.userId,
                recipient: currentStudent.userId,
                isTyping: false
            });
            typingTimeout = null;
        }, 1000);
    });
    
    socket.on('typing', (data) => {
        if (currentStudent && data.sender === currentStudent.userId && data.recipient === shopkeeperData.userId) {
            const typingIndicator = document.createElement('div');
            typingIndicator.id = 'typing-indicator';
            typingIndicator.className = 'typing-indicator';
            typingIndicator.textContent = `${currentStudent.name} is typing...`;
            
            // Remove existing indicator if any
            const existingIndicator = document.getElementById('typing-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            if (data.isTyping) {
                messagesEl.appendChild(typingIndicator);
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }
        }
    });
    
    // Check for new messages periodically
    setInterval(async () => {
        if (shopkeeperData.userId) {
            await getUnreadMessageCounts();
            students.forEach(student => {
                updateStudentListItem(student);
            });
        }
    }, 10000);
});