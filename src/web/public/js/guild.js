        let socket;
        let guildId;
        let currentPlayer = null;
        let progressUpdateInterval = null;

        // Initialize guild dashboard
        async function initGuildDashboard() {
            guildId = window.location.pathname.split('/').pop();

            try {
                const response = await fetch(`/api/guilds/${guildId}`);
                if (!response.ok) {
                    throw new Error('Failed to load guild data');
                }

                const guildData = await response.json();
                updateGuildUI(guildData);
                initSocket();
                loadQueue();
                loadPlaylists();
                loadTextChannels();
                loadFilterStatus();
                loadAdvancedSettings();
                loadUserPreferences();
            } catch (error) {
                console.error('Error loading guild dashboard:', error);
                window.location.href = '/dashboard';
            }
        }

        // Update guild UI
        function updateGuildUI(guildData) {
            document.getElementById('guild-name').textContent = guildData.name;

            if (guildData.settings) {
                // Prefix is always "!" and not configurable
                // Force Czech as default even for existing guilds (override old EnglishUS setting)
                const currentLanguage = guildData.settings.language;
                if (currentLanguage === 'EnglishUS' || !currentLanguage) {
                    document.getElementById('language-select').value = 'Czech';
                } else {
                    document.getElementById('language-select').value = currentLanguage;
                }
                document.getElementById('text-channel-select').value = guildData.settings.textChannelId || '';
            } else {
                // Set defaults for new guilds
                document.getElementById('language-select').value = 'Czech';
            }

            if (guildData.player) {
                currentPlayer = guildData.player;
                console.log('Initial player data:', currentPlayer);
                updatePlayerUI();

                // Start progress timer if track is playing
                if (currentPlayer.current && !currentPlayer.paused) {
                    startProgressTimer();
                }
            } else {
                // No player exists
                currentPlayer = null;
                updatePlayerUI();
            }
        }



        // Socket.IO initialization
        function initSocket() {
            socket = io();

            socket.emit('join-guild', guildId);

            socket.on('trackStart', (data) => {
                if (data.guildId === guildId) {
                    console.log('Track started:', data.track);
                    updateCurrentTrack(data.track);
                }
            });

            socket.on('playerUpdate', (data) => {
                if (data.guildId === guildId) {
                    console.log('Player update received:', data);

                    // Update player state
                    if (currentPlayer) {
                        currentPlayer = { ...currentPlayer, ...data };
                    } else {
                        currentPlayer = data;
                    }

                    // Update UI elements
                    updatePlayerUI();

                    // Update progress bar if we have position and current track
                    if (data.position !== undefined && currentPlayer.current) {
                        // Reset the estimated position tracking
                        currentPlayer.lastUpdateTime = Date.now();
                        currentPlayer.estimatedPosition = data.position;
                        updateProgressBar(data.position, currentPlayer.current.duration);
                    }

                    // Start or stop progress timer based on playing state
                    if (currentPlayer.current && !currentPlayer.paused) {
                        startProgressTimer();
                    } else {
                        stopProgressTimer();
                    }
                }
            });

            socket.on('playerCreate', (data) => {
                if (data.guildId === guildId) {
                    console.log('Player created/connected:', data);
                    refreshGuildData();
                }
            });

            socket.on('playerDestroy', (data) => {
                if (data.guildId === guildId) {
                    console.log('Player destroyed/disconnected:', data);
                    currentPlayer = null;
                    updateConnectionStatus(false, null, null);
                }
            });

            // Real-time queue updates
            socket.on('queueUpdate', (data) => {
                if (data.guildId === guildId) {
                    console.log('Queue updated:', data);
                    updateQueueUI(data);
                }
            });

            // Real-time track updates
            socket.on('trackEnd', (data) => {
                if (data.guildId === guildId) {
                    console.log('Track ended:', data);
                    // Queue will be updated via queueUpdate event
                }
            });

            socket.on('queueEnd', (data) => {
                if (data.guildId === guildId) {
                    console.log('Queue ended:', data);
                    // Clear the queue display
                    updateQueueUI({ tracks: [], current: null });
                }
            });
        }

        // Player control functions
        async function togglePlayPause() {
            try {
                const response = await fetch(`/api/guilds/${guildId}/player/pause`, {
                    method: 'POST'
                });
                const result = await response.json();
                if (result.success) {
                    currentPlayer.paused = result.paused;
                    updatePlayerUI();

                    // Handle progress timer based on play/pause state
                    if (result.paused) {
                        stopProgressTimer();
                    } else {
                        startProgressTimer();
                    }
                }
            } catch (error) {
                console.error('Error toggling play/pause:', error);
            }
        }

        async function nextTrack() {
            try {
                await fetch(`/api/guilds/${guildId}/player/skip`, {
                    method: 'POST'
                });
            } catch (error) {
                console.error('Error skipping track:', error);
            }
        }

        // Previous: restart the current track (seek to 0). This was previously
        // referenced by the UI but never defined, so the button threw an error.
        async function previousTrack() {
            if (!currentPlayer || !currentPlayer.current) return;

            // Restarting only makes sense for seekable (non-radio) tracks.
            const isRadio = !currentPlayer.current.duration || currentPlayer.current.duration === 0;
            if (isRadio) {
                if (typeof showTemporaryMessage === 'function') {
                    showTemporaryMessage('Cannot restart a live radio stream', 'error');
                }
                return;
            }

            try {
                const response = await fetch(`/api/guilds/${guildId}/player/seek`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ position: 0 })
                });
                if (response.ok) {
                    updateProgressBar(0, currentPlayer.current.duration);
                }
            } catch (error) {
                console.error('Error restarting track:', error);
            }
        }

        async function stopPlayer() {
            try {
                await fetch(`/api/guilds/${guildId}/player/stop`, {
                    method: 'POST'
                });
            } catch (error) {
                console.error('Error stopping player:', error);
            }
        }

        // Seek functionality
        async function seekToPosition(event) {
            if (!currentPlayer || !currentPlayer.current) return;

            // Don't allow seeking on radio streams
            const isRadio = !currentPlayer.current.duration || currentPlayer.current.duration === 0;
            if (isRadio) {
                console.log('Cannot seek in radio stream');
                return;
            }

            const progressContainer = event.target.closest('#normal-progress');
            if (!progressContainer) return;

            const rect = progressContainer.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const percentage = clickX / rect.width;
            const seekPosition = Math.floor(currentPlayer.current.duration * percentage);

            try {
                const response = await fetch(`/api/guilds/${guildId}/player/seek`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ position: seekPosition })
                });

                if (response.ok) {
                    // Update progress bar immediately for better UX
                    updateProgressBar(seekPosition, currentPlayer.current.duration);
                }
            } catch (error) {
                console.error('Error seeking:', error);
            }
        }

        function updateProgressBar(position, duration) {
            const isRadio = !duration || duration === 0;

            if (isRadio) {
                // Show radio live indicator
                document.getElementById('normal-progress').classList.add('hidden');
                document.getElementById('radio-progress').classList.remove('hidden');
                document.getElementById('current-time').textContent = 'LIVE';
                document.getElementById('total-time').textContent = 'RADIO';
            } else {
                // Show normal progress bar
                document.getElementById('normal-progress').classList.remove('hidden');
                document.getElementById('radio-progress').classList.add('hidden');

                const percentage = (position / duration) * 100;
                document.getElementById('progress-bar').style.width = `${Math.min(100, Math.max(0, percentage))}%`;
                document.getElementById('current-time').textContent = formatDuration(position);
                document.getElementById('total-time').textContent = formatDuration(duration);
            }
        }

        // Enhanced player UI update
        function updatePlayerUI() {
            if (!currentPlayer) {
                // No player - show disconnected status
                updateConnectionStatus(false, null, null);
                return;
            }

            // Update connection status - check both connected flag and voiceChannelId
            const isConnected = currentPlayer.connected && currentPlayer.voiceChannelId;
            updateConnectionStatus(isConnected, currentPlayer.voiceChannelId, currentPlayer.voiceChannelName);

            const playPauseBtn = document.getElementById('play-pause-btn');
            const playPauseIcon = playPauseBtn.querySelector('i');

            if (currentPlayer.paused) {
                playPauseIcon.className = 'fas fa-play';
            } else {
                playPauseIcon.className = 'fas fa-pause';
            }

            document.getElementById('volume-slider').value = currentPlayer.volume;
            document.getElementById('volume-display').textContent = `${currentPlayer.volume}%`;

            if (currentPlayer.current) {
                const track = currentPlayer.current;

                // Update track display normally - radio detection is handled server-side
                document.getElementById('track-title').textContent = track.title;
                document.getElementById('track-author').textContent = track.author;

                // Update progress bar
                updateProgressBar(currentPlayer.position || 0, track.duration);

                if (track.thumbnail) {
                    const thumbnail = document.getElementById('track-thumbnail');
                    thumbnail.src = track.thumbnail;
                    thumbnail.classList.remove('hidden');
                    document.getElementById('no-track').classList.add('hidden');
                } else {
                    document.getElementById('track-thumbnail').classList.add('hidden');
                    document.getElementById('no-track').classList.remove('hidden');
                }
            } else {
                // No track playing
                document.getElementById('track-title').textContent = 'No track playing';
                document.getElementById('track-author').textContent = 'Select a track to start playing';
                document.getElementById('track-thumbnail').classList.add('hidden');
                document.getElementById('no-track').classList.remove('hidden');

                // Reset to normal progress bar and clear it
                document.getElementById('normal-progress').classList.remove('hidden');
                document.getElementById('radio-progress').classList.add('hidden');
                document.getElementById('progress-bar').style.width = '0%';
                document.getElementById('current-time').textContent = '0:00';
                document.getElementById('total-time').textContent = '0:00';
            }
        }

        // Update connection status display
        function updateConnectionStatus(connected, voiceChannelId, voiceChannelName) {
            const statusElement = document.getElementById('connection-status');

            console.log('Updating connection status:', { connected, voiceChannelId, voiceChannelName });

            if (connected && voiceChannelId) {
                const channelDisplay = voiceChannelName ? voiceChannelName : 'Voice Channel';
                statusElement.innerHTML = `
                    <span class="text-green-600 connection-status">
                        <i class="fas fa-circle text-green-500 mr-1"></i>
                        Connected to <span class="channel-name">${channelDisplay}</span>
                    </span>
                `;
            } else {
                statusElement.innerHTML = `
                    <span class="text-gray-500 connection-status">
                        <i class="fas fa-circle text-red-500 mr-1"></i>
                        Not Connected
                    </span>
                `;
            }
        }

        async function addTrack() {
            const query = document.getElementById('search-input').value.trim();
            if (!query) return;

            // Check if something is currently playing or in queue
            const hasQueue = currentPlayer && currentPlayer.current;

            if (hasQueue) {
                // Check if current track is a radio stream
                const isRadio = !currentPlayer.current.duration || currentPlayer.current.duration === 0;

                if (isRadio) {
                    // Radio is playing - automatically force play since radio never ends
                    console.log('Radio is playing - automatically force playing new track');
                    await forcePlayTrack(query);
                } else {
                    // Regular music is playing - ask user what to do
                    const choice = await showPlayChoiceModal(query);
                    if (choice === 'cancel') {
                        return; // User cancelled
                    }

                    if (choice === 'force') {
                        await forcePlayTrack(query);
                    } else {
                        await addToQueue(query);
                    }
                }
            } else {
                // Nothing playing - just add it (will start playing automatically)
                await addToQueue(query);
            }

            // Clear the search input
            document.getElementById('search-input').value = '';
        }

        async function addToQueue(query) {
            try {
                const selectedSource = document.getElementById('search-source-select').value;
                const response = await fetch(`/api/guilds/${guildId}/player/play`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query, source: selectedSource })
                });

                const result = await response.json();

                if (response.ok) {
                    // Queue will be updated via Socket.IO
                    // Radio detection is handled server-side
                    if (result.autoJoined) {
                        console.log('Bot automatically joined voice channel');
                        // You could show a notification here if desired
                    }
                } else {
                    // Handle specific error messages
                    let errorMessage = result.message || 'Failed to add track to queue';
                    if (response.status === 400 && result.message?.includes('voice channel')) {
                        showTemporaryMessage('You must be in a voice channel to play music', 'error');
                    } else if (response.status === 403 && result.message?.includes('permission')) {
                        showTemporaryMessage('Bot doesn\'t have permission to join your voice channel', 'error');
                    } else {
                        console.error('Failed to add track to queue:', errorMessage);
                        showTemporaryMessage(errorMessage, 'error');
                    }
                }
            } catch (error) {
                console.error('Error adding track to queue:', error);
                showTemporaryMessage('Error adding track to queue. Please try again.', 'error');
            }
        }

        async function forcePlayTrack(query) {
            try {
                const selectedSource = document.getElementById('search-source-select').value;
                const response = await fetch(`/api/guilds/${guildId}/player/force-play`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query, source: selectedSource })
                });

                const result = await response.json();
                if (result.success) {
                    // Queue will be updated via Socket.IO
                    // Radio detection is handled server-side
                    if (result.autoJoined) {
                        console.log('Bot automatically joined voice channel for force play');
                    }
                } else {
                    // Handle specific error messages
                    let errorMessage = result.message || 'Failed to force play track';
                    if (response.status === 400 && result.message?.includes('voice channel')) {
                        showTemporaryMessage('You must be in a voice channel to play music', 'error');
                    } else if (response.status === 403 && result.message?.includes('permission')) {
                        showTemporaryMessage('Bot doesn\'t have permission to join your voice channel', 'error');
                    } else {
                        showTemporaryMessage(errorMessage, 'error');
                    }
                }
            } catch (error) {
                console.error('Error force playing track:', error);
                showTemporaryMessage('Error force playing track. Please try again.', 'error');
            }
        }

        // Force play function (for the Force button)
        async function forcePlay() {
            const query = document.getElementById('search-input').value.trim();
            if (!query) {
                showTemporaryMessage('Please enter a song to force play', 'error');
                return;
            }

            await forcePlayTrack(query);
            document.getElementById('search-input').value = '';
        }

        function showPlayChoiceModal(query) {
            return new Promise((resolve) => {
                // Create modal HTML
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50';
                modal.innerHTML = `
                    <div class="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
                        <div class="flex items-center mb-4">
                            <i class="fas fa-music text-purple-600 mr-3"></i>
                            <h3 class="text-lg font-medium text-gray-900">Add Track</h3>
                        </div>
                        <div class="mb-4">
                            <p class="text-sm text-gray-600 mb-2">Music is currently playing. How would you like to add this track?</p>
                            <div class="bg-gray-50 p-3 rounded-md">
                                <p class="text-sm font-medium text-gray-800 truncate">${escapeHtml(query)}</p>
                            </div>
                        </div>
                        <div class="flex flex-col space-y-2">
                            <button id="choice-queue" class="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center justify-center">
                                <i class="fas fa-plus mr-2"></i>
                                Add to Queue
                                <span class="text-xs ml-2 opacity-75">(Play after current tracks)</span>
                            </button>
                            <button id="choice-force" class="choice-force-btn w-full text-white px-4 py-2 rounded-md flex items-center justify-center">
                                <i class="fas fa-bolt mr-2"></i>
                                Play Now
                                <span class="text-xs ml-2 opacity-75">(Skip current track)</span>
                            </button>
                            <button id="choice-cancel" class="w-full bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md">
                                Cancel
                            </button>
                        </div>
                    </div>
                `;

                // Add event listeners
                modal.querySelector('#choice-queue').addEventListener('click', () => {
                    document.body.removeChild(modal);
                    resolve('queue');
                });

                modal.querySelector('#choice-force').addEventListener('click', () => {
                    document.body.removeChild(modal);
                    resolve('force');
                });

                modal.querySelector('#choice-cancel').addEventListener('click', () => {
                    document.body.removeChild(modal);
                    resolve('cancel');
                });

                // Close on background click
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        document.body.removeChild(modal);
                        resolve('cancel');
                    }
                });

                // Add to DOM
                document.body.appendChild(modal);
            });
        }

        // Radio station functions with auto-join and force play
        async function playRadioStation(url, name, buttonElement, stationId) {
            try {
                // Get button element
                const button = buttonElement || event.target.closest('button');
                const originalContent = button.innerHTML;

                // Show loading state
                button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Connecting...';
                button.disabled = true;

                // Use force-play for radio stations to automatically skip current queue
                const response = await fetch(`/api/guilds/${guildId}/player/force-play`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query: url })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    // Success - show feedback
                    if (result.autoJoined) {
                        button.innerHTML = '<i class="fas fa-check mr-2"></i>Joined & Playing!';
                        console.log(`Auto-joined voice channel and started radio station: ${name} (${stationId})`);
                    } else {
                        button.innerHTML = '<i class="fas fa-check mr-2"></i>Playing!';
                        console.log(`Started radio station: ${name} (${stationId})`);
                    }

                    // Radio detection is now handled server-side
                    setTimeout(() => {
                        button.innerHTML = originalContent;
                        button.disabled = false;
                    }, 2000);
                } else {
                    // Handle specific error messages
                    let errorMessage = result.message || 'Failed to play radio station';
                    if (response.status === 400 && result.message?.includes('voice channel')) {
                        errorMessage = 'You must be in a voice channel to play music';
                    } else if (response.status === 403 && result.message?.includes('permission')) {
                        errorMessage = 'Bot doesn\'t have permission to join your voice channel';
                    }

                    throw new Error(errorMessage);
                }
            } catch (error) {
                console.error('Error playing radio station:', error);
                showTemporaryMessage(`Failed to play ${name}: ${error.message}`, 'error');

                // Restore button
                const button = buttonElement || event.target.closest('button');
                if (button && typeof originalContent !== 'undefined') {
                    button.innerHTML = originalContent;
                    button.disabled = false;
                }
            }
        }



        // Advanced control functions
        let currentRepeatMode = 'off';
        let currentFairPlay = false;

        async function toggleRepeat() {
            const modes = ['off', 'track', 'queue'];
            const currentIndex = modes.indexOf(currentRepeatMode);
            const nextMode = modes[(currentIndex + 1) % modes.length];

            try {
                const response = await fetch(`/api/guilds/${guildId}/player/repeat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ mode: nextMode })
                });

                const result = await response.json();
                if (result.success) {
                    currentRepeatMode = nextMode;
                    updateRepeatButton();
                }
            } catch (error) {
                console.error('Error toggling repeat:', error);
            }
        }

        function updateRepeatButton() {
            const btn = document.getElementById('repeat-btn');
            const text = document.getElementById('repeat-text');

            switch (currentRepeatMode) {
                case 'off':
                    btn.className = 'bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm';
                    text.textContent = 'Repeat: Off';
                    break;
                case 'track':
                    btn.className = 'bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm';
                    text.textContent = 'Repeat: Track';
                    break;
                case 'queue':
                    btn.className = 'bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm';
                    text.textContent = 'Repeat: Queue';
                    break;
            }
        }

        async function toggleFairPlay() {
            try {
                const response = await fetch(`/api/guilds/${guildId}/player/fairplay`, {
                    method: 'POST'
                });

                const result = await response.json();
                if (result.success) {
                    currentFairPlay = result.fairPlay;
                    updateFairPlayButton();
                    if (currentFairPlay) {
                        showTemporaryMessage('Fair Play enabled - Queue reordered fairly', 'success');
                        // Queue will be updated via Socket.IO
                    }
                }
            } catch (error) {
                console.error('Error toggling fair play:', error);
            }
        }

        function updateFairPlayButton() {
            const btn = document.getElementById('fairplay-btn');
            const text = document.getElementById('fairplay-text');

            if (currentFairPlay) {
                btn.className = 'bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm';
                text.textContent = 'Fair Play: On';
            } else {
                btn.className = 'bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm';
                text.textContent = 'Fair Play: Off';
            }
        }

        async function shuffleQueue() {

            try {
                const response = await fetch(`/api/guilds/${guildId}/queue/shuffle`, {
                    method: 'POST'
                });

                const result = await response.json();
                if (result.success) {
                    showTemporaryMessage('Queue shuffled successfully!', 'success');
                    // Queue will be updated via Socket.IO
                }
            } catch (error) {
                console.error('Error shuffling queue:', error);
                showTemporaryMessage('Error shuffling queue', 'error');
            }
        }

        async function clearQueue() {

            try {
                const response = await fetch(`/api/guilds/${guildId}/queue/clear`, {
                    method: 'POST'
                });

                const result = await response.json();
                if (result.success) {
                    showTemporaryMessage(result.message, 'success');
                    // Queue will be updated via Socket.IO
                }
            } catch (error) {
                console.error('Error clearing queue:', error);
                showTemporaryMessage('Error clearing queue', 'error');
            }
        }

        // Join user's voice channel
        async function joinMyChannel() {
            try {
                const response = await fetch(`/api/guilds/${guildId}/player/join-my-channel`, {
                    method: 'POST'
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    switch (response.status) {
                        case 400:
                            showTemporaryMessage('You need to be in a voice channel first!', 'error');
                            break;
                        case 403:
                            showTemporaryMessage('Bot does not have permission to join your voice channel', 'error');
                            break;
                        case 404:
                            showTemporaryMessage('You are not a member of this server', 'error');
                            break;
                        default:
                            showTemporaryMessage(errorData.message || 'Error joining voice channel', 'error');
                    }
                    return;
                }

                const result = await response.json();
                if (result.success) {
                    showTemporaryMessage(result.message, 'success');

                    // Immediately update the connection status with channel name
                    updateConnectionStatus(true, result.channelId, result.channelName);

                    // Refresh guild data after a short delay to ensure player is fully connected
                    setTimeout(async () => {
                        await refreshGuildData();
                    }, 1000);
                } else {
                    showTemporaryMessage('Failed to join your voice channel', 'error');
                }
            } catch (error) {
                console.error('Error joining voice channel:', error);
                showTemporaryMessage('Error joining voice channel. Please try again.', 'error');
            }
        }

        // Update current track display
        function updateCurrentTrack(track) {
            console.log('Updating current track:', track);

            // Update the current track info in the player
            if (currentPlayer) {
                currentPlayer.current = track;
            } else {
                // Create a minimal player object if it doesn't exist
                currentPlayer = {
                    current: track,
                    connected: true,
                    playing: true,
                    paused: false,
                    volume: 100,
                    position: 0
                };
            }

            // Update the UI immediately
            document.getElementById('track-title').textContent = track.title;
            document.getElementById('track-author').textContent = track.author;

            if (track.thumbnail) {
                const thumbnail = document.getElementById('track-thumbnail');
                thumbnail.src = track.thumbnail;
                thumbnail.classList.remove('hidden');
                document.getElementById('no-track').classList.add('hidden');
            }

            // Update progress bar
            updateProgressBar(0, track.duration);

            // Update play/pause button to show playing state
            const playPauseBtn = document.getElementById('play-pause-btn');
            const playPauseIcon = playPauseBtn.querySelector('i');
            playPauseIcon.className = 'fas fa-pause';

            // Start progress update timer
            startProgressTimer();
        }

        // Start progress update timer
        function startProgressTimer() {
            console.log('Starting progress timer...');

            // Clear existing timer
            if (progressUpdateInterval) {
                clearInterval(progressUpdateInterval);
            }

            // Start new timer if we have a playing track that's not a radio stream
            if (currentPlayer && currentPlayer.current && !currentPlayer.paused) {
                const isRadio = !currentPlayer.current.duration || currentPlayer.current.duration === 0;

                if (isRadio) {
                    console.log('Radio stream detected - no progress timer needed');
                    return;
                }

                console.log('Progress timer started for track:', currentPlayer.current.title);

                // Initialize timing
                currentPlayer.lastUpdateTime = Date.now();
                currentPlayer.estimatedPosition = currentPlayer.position || 0;

                progressUpdateInterval = setInterval(() => {
                    if (currentPlayer && currentPlayer.current && !currentPlayer.paused) {
                        const isRadio = !currentPlayer.current.duration || currentPlayer.current.duration === 0;

                        if (isRadio) {
                            // Stop timer for radio streams
                            console.log('Radio stream detected during timer - stopping progress timer');
                            stopProgressTimer();
                            return;
                        }

                        // Estimate current position based on time elapsed
                        const now = Date.now();
                        const elapsed = now - currentPlayer.lastUpdateTime;
                        currentPlayer.estimatedPosition += elapsed;
                        currentPlayer.lastUpdateTime = now;

                        // Update progress bar with estimated position
                        updateProgressBar(currentPlayer.estimatedPosition, currentPlayer.current.duration);

                        // Debug log every 10 seconds
                        if (Math.floor(currentPlayer.estimatedPosition / 1000) % 10 === 0) {
                            console.log('Progress update:', formatDuration(currentPlayer.estimatedPosition), '/', formatDuration(currentPlayer.current.duration));
                        }
                    } else {
                        // Stop timer if not playing
                        console.log('Stopping progress timer - not playing');
                        stopProgressTimer();
                    }
                }, 500); // Update every 500ms for smoother progress
            } else {
                console.log('Cannot start progress timer - no track or paused');
            }
        }

        // Stop progress update timer
        function stopProgressTimer() {
            console.log('Stopping progress timer...');
            if (progressUpdateInterval) {
                clearInterval(progressUpdateInterval);
                progressUpdateInterval = null;
                console.log('Progress timer stopped');
            }
        }

        // Refresh guild data
        async function refreshGuildData() {
            try {
                const response = await fetch(`/api/guilds/${guildId}`);
                if (response.ok) {
                    const guildData = await response.json();
                    if (guildData.player) {
                        currentPlayer = guildData.player;
                        updatePlayerUI();
                    }
                }
            } catch (error) {
                console.error('Error refreshing guild data:', error);
            }
        }

        // Volume control
        document.getElementById('volume-slider').addEventListener('input', async (e) => {
            const volume = parseInt(e.target.value);
            document.getElementById('volume-display').textContent = `${volume}%`;
            
            try {
                await fetch(`/api/guilds/${guildId}/player/volume`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ volume })
                });
            } catch (error) {
                console.error('Error setting volume:', error);
            }
        });

        // Load queue
        async function loadQueue() {
            try {
                const response = await fetch(`/api/guilds/${guildId}/queue`);
                const queueData = await response.json();
                updateQueueUI(queueData);
            } catch (error) {
                console.error('Error loading queue:', error);
            }
        }

        // Update queue UI
        function updateQueueUI(queueData) {
            const queueList = document.getElementById('queue-list');
            const queueCount = document.getElementById('queue-count');
            const queueStats = document.getElementById('queue-stats');

            if (!queueData.tracks || queueData.tracks.length === 0) {
                queueList.innerHTML = '<p class="text-gray-500 text-center py-4">Queue is empty</p>';
                queueCount.textContent = '(0 tracks)';
                queueStats.innerHTML = '';
                return;
            }

            // Update queue count and stats
            const totalTracks = queueData.tracks.length;
            const totalDuration = queueData.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);

            queueCount.textContent = `(${totalTracks} tracks)`;
            queueStats.innerHTML = `
                <div class="flex justify-between text-xs">
                    <span>Total Duration: ${formatDuration(totalDuration)}</span>
                    <span>Tracks: ${totalTracks}</span>
                </div>
            `;

            queueList.innerHTML = queueData.tracks.map((track, index) => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                    <div class="flex items-center flex-1 min-w-0">
                        <span class="text-xs text-gray-400 mr-3 w-6">${index + 1}</span>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-900 truncate">${track.title}</p>
                            <p class="text-xs text-gray-500 truncate">${track.author} • ${formatDuration(track.duration)}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-1 ml-2">
                        ${index > 0 ? `<button onclick="moveTrackUp(${index})" class="text-blue-500 hover:text-blue-700 p-1" title="Move up">
                            <i class="fas fa-chevron-up text-xs"></i>
                        </button>` : ''}
                        ${index < queueData.tracks.length - 1 ? `<button onclick="moveTrackDown(${index})" class="text-blue-500 hover:text-blue-700 p-1" title="Move down">
                            <i class="fas fa-chevron-down text-xs"></i>
                        </button>` : ''}
                        <button onclick="jumpToTrack(${index})" class="text-green-500 hover:text-green-700 p-1" title="Jump to this track">
                            <i class="fas fa-play text-xs"></i>
                        </button>
                        <button onclick="removeFromQueue(${index})" class="text-red-500 hover:text-red-700 p-1" title="Remove from queue">
                            <i class="fas fa-times text-xs"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }

        // Queue manipulation functions
        async function moveTrackUp(index) {
            if (index <= 0) return;

            try {
                const response = await fetch(`/api/guilds/${guildId}/queue/move`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ from: index, to: index - 1 })
                });

                if (response.ok) {
                    // Queue will be updated via Socket.IO
                }
            } catch (error) {
                console.error('Error moving track up:', error);
            }
        }

        async function moveTrackDown(index) {
            try {
                const response = await fetch(`/api/guilds/${guildId}/queue/move`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ from: index, to: index + 1 })
                });

                if (response.ok) {
                    // Queue will be updated via Socket.IO
                }
            } catch (error) {
                console.error('Error moving track down:', error);
            }
        }

        async function jumpToTrack(index) {

            try {
                const response = await fetch(`/api/guilds/${guildId}/queue/jump/${index}`, {
                    method: 'POST'
                });

                const result = await response.json();
                if (result.success) {
                    // Queue will be updated via Socket.IO
                }
            } catch (error) {
                console.error('Error jumping to track:', error);
                showTemporaryMessage('Error jumping to track', 'error');
            }
        }

        async function removeFromQueue(index) {
            try {
                const response = await fetch(`/api/guilds/${guildId}/queue/${index}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    // Queue will be updated via Socket.IO
                }
            } catch (error) {
                console.error('Error removing track from queue:', error);
            }
        }

        // Utility function to format duration
        function formatDuration(ms) {
            // Handle null, undefined, or invalid values
            if (!ms || ms === 0 || isNaN(ms)) return '0:00';

            // Ensure we have a number
            const duration = Number(ms);
            if (isNaN(duration)) return '0:00';

            const seconds = Math.floor(duration / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);

            if (hours > 0) {
                return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
            } else {
                return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
            }
        }

        // Utility function to escape HTML
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Load available text channels
        async function loadTextChannels() {
            try {
                const response = await fetch(`/api/guilds/${guildId}/channels`);
                const data = await response.json();

                const select = document.getElementById('text-channel-select');

                // Clear existing options except the default
                while (select.children.length > 1) {
                    select.removeChild(select.lastChild);
                }

                let botCommandsChannelId = null;

                // Add channel options
                data.channels.forEach(channel => {
                    const option = document.createElement('option');
                    option.value = channel.id;
                    option.textContent = `# ${channel.name}`;
                    select.appendChild(option);

                    // Check if this is the bot-commands channel
                    if (channel.name.toLowerCase() === 'bot-commands') {
                        botCommandsChannelId = channel.id;
                    }
                });

                // Auto-select bot-commands if it exists and no channel is currently selected
                if (botCommandsChannelId && !select.value) {
                    select.value = botCommandsChannelId;
                }
            } catch (error) {
                console.error('Error loading text channels:', error);
            }
        }

        // Save settings
        async function saveSettings() {
            const language = document.getElementById('language-select').value;
            const textChannelId = document.getElementById('text-channel-select').value;

            try {
                await fetch(`/api/guilds/${guildId}/settings`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        prefix: '!', // Always use ! as prefix
                        language,
                        textChannelId: textChannelId || null
                    })
                });

                showTemporaryMessage('Settings saved successfully!', 'success');
            } catch (error) {
                console.error('Error saving settings:', error);

                // Handle specific error cases
                if (error.response) {
                    const errorData = await error.response.json();
                    switch (error.response.status) {
                        case 400:
                            showTemporaryMessage('Invalid text channel selected', 'error');
                            break;
                        case 403:
                            showTemporaryMessage('Bot does not have permission to send messages in the selected channel', 'error');
                            break;
                        default:
                            showTemporaryMessage(errorData.message || 'Error saving settings', 'error');
                    }
                } else {
                    showTemporaryMessage('Error saving settings', 'error');
                }
            }
        }

        // Playlist Management Functions
        async function loadPlaylists() {
            try {
                const response = await fetch(`/api/playlists?guildId=${guildId}`);
                const data = await response.json();
                updatePlaylistsUI(data.playlists);
            } catch (error) {
                console.error('Error loading playlists:', error);
            }
        }

        function updatePlaylistsUI(playlists) {
            const playlistsList = document.getElementById('playlists-list');

            if (!playlists || playlists.length === 0) {
                playlistsList.innerHTML = '<p class="text-gray-500 text-center py-4">No playlists found</p>';
                return;
            }

            playlistsList.innerHTML = playlists.map(playlist => `
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100">
                    <div class="flex-1 cursor-pointer" onclick="showPlaylistDetails('${playlist.id}')">
                        <p class="text-sm font-medium text-gray-900 truncate">${playlist.name}</p>
                        <p class="text-xs text-gray-500">${playlist.trackCount} tracks • ${formatDate(playlist.updatedAt)}</p>
                    </div>
                    <div class="flex space-x-1">
                        <button onclick="showPlaylistDetails('${playlist.id}')" class="text-blue-600 hover:text-blue-800 p-1" title="View/Edit playlist">
                            <i class="fas fa-eye text-xs"></i>
                        </button>
                        <button onclick="loadPlaylist('${playlist.id}')" class="text-green-600 hover:text-green-800 p-1" title="Load playlist">
                            <i class="fas fa-play text-xs"></i>
                        </button>
                        <button onclick="deletePlaylist('${playlist.id}')" class="text-red-600 hover:text-red-800 p-1" title="Delete playlist">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }

        async function loadPlaylist(playlistId) {
            try {
                const response = await fetch(`/api/guilds/${guildId}/playlists/${playlistId}/load`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ shuffle: false })
                });

                const result = await response.json();
                if (result.success) {
                    showTemporaryMessage(result.message, 'success');
                    // Queue will be updated via Socket.IO
                }
            } catch (error) {
                console.error('Error loading playlist:', error);
                showTemporaryMessage('Error loading playlist', 'error');
            }
        }

        async function deletePlaylist(playlistId) {

            try {
                const response = await fetch(`/api/playlists/${playlistId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    loadPlaylists(); // Refresh playlists list
                    showTemporaryMessage('Playlist deleted successfully', 'success');
                } else {
                    showTemporaryMessage('Error deleting playlist', 'error');
                }
            } catch (error) {
                console.error('Error deleting playlist:', error);
                showTemporaryMessage('Error deleting playlist', 'error');
            }
        }

        function showCreatePlaylistModal() {
            document.getElementById('createPlaylistModal').classList.remove('hidden');
        }

        function hideCreatePlaylistModal() {
            document.getElementById('createPlaylistModal').classList.add('hidden');
            document.getElementById('createPlaylistForm').reset();
        }

        async function saveCurrentQueue() {
            try {
                const response = await fetch(`/api/guilds/${guildId}/queue`);
                const queueData = await response.json();

                if (!queueData.tracks || queueData.tracks.length === 0) {
                    showTemporaryMessage('Queue is empty. Add some tracks first!', 'error');
                    return;
                }

                // Pre-fill modal with queue data
                document.getElementById('includeCurrentQueue').checked = true;
                showCreatePlaylistModal();
            } catch (error) {
                console.error('Error getting queue:', error);
                showTemporaryMessage('Error accessing queue', 'error');
            }
        }

        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString();
        }

        // Enhanced Playlist Management Functions
        let currentPlaylistId = null;

        function showImportPlaylistModal() {
            document.getElementById('importPlaylistModal').classList.remove('hidden');
        }

        function hideImportPlaylistModal() {
            document.getElementById('importPlaylistModal').classList.add('hidden');
            document.getElementById('importPlaylistForm').reset();
        }

        async function showPlaylistDetails(playlistId) {
            currentPlaylistId = playlistId;

            try {
                const response = await fetch(`/api/playlists/${playlistId}/tracks`);
                const data = await response.json();

                // Update modal title and info
                document.getElementById('playlistDetailsTitle').textContent = data.playlist.name;
                document.getElementById('playlistInfo').innerHTML = `
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-sm text-gray-600">Name</p>
                            <p class="font-medium">${data.playlist.name}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">Tracks</p>
                            <p class="font-medium">${data.playlist.trackCount}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">Created</p>
                            <p class="font-medium">${formatDate(data.playlist.createdAt)}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">Visibility</p>
                            <p class="font-medium">${data.playlist.isPublic ? 'Public' : 'Private'}</p>
                        </div>
                    </div>
                    ${data.playlist.description ? `<p class="mt-2 text-sm text-gray-700">${data.playlist.description}</p>` : ''}
                `;

                // Update tracks list
                updatePlaylistTracksUI(data.tracks);

                // Show modal
                document.getElementById('playlistDetailsModal').classList.remove('hidden');
            } catch (error) {
                console.error('Error loading playlist details:', error);
                showTemporaryMessage('Error loading playlist details', 'error');
            }
        }

        function hidePlaylistDetailsModal() {
            document.getElementById('playlistDetailsModal').classList.add('hidden');
            currentPlaylistId = null;
        }

        function updatePlaylistTracksUI(tracks) {
            const tracksContainer = document.getElementById('playlistTracks');

            if (!tracks || tracks.length === 0) {
                tracksContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No tracks in this playlist</p>';
                return;
            }

            tracksContainer.innerHTML = tracks.map((track, index) => `
                <div class="flex items-center justify-between p-3 bg-white border rounded-lg hover:bg-gray-50">
                    <div class="flex items-center space-x-3 flex-1">
                        <div class="text-sm text-gray-500 w-8">${index + 1}</div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-900 truncate">${track.title}</p>
                            <p class="text-xs text-gray-500 truncate">${track.author} • ${formatDuration(track.duration)}</p>
                        </div>
                    </div>
                    <div class="flex space-x-1">
                        <button onclick="playTrackFromPlaylist('${track.uri.replace(/'/g, "\\'")}', '${track.title.replace(/'/g, "\\'")}', false)" class="text-green-600 hover:text-green-800 p-1" title="Add to queue">
                            <i class="fas fa-plus text-xs"></i>
                        </button>
                        <button onclick="playTrackFromPlaylist('${track.uri.replace(/'/g, "\\'")}', '${track.title.replace(/'/g, "\\'")}', true)" class="text-blue-600 hover:text-blue-800 p-1" title="Force play now">
                            <i class="fas fa-play text-xs"></i>
                        </button>
                        <button onclick="removeTrackFromPlaylist(${index})" class="text-red-600 hover:text-red-800 p-1" title="Remove track">
                            <i class="fas fa-times text-xs"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }

        async function addTrackToPlaylist() {
            if (!currentPlaylistId) return;

            const query = document.getElementById('addTrackQuery').value.trim();
            if (!query) {
                showTemporaryMessage('Please enter a song name or URL', 'error');
                return;
            }

            try {
                const selectedSource = document.getElementById('playlist-search-source-select').value;
                const response = await fetch(`/api/playlists/${currentPlaylistId}/tracks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query, source: selectedSource })
                });

                const result = await response.json();
                if (response.ok) {
                    document.getElementById('addTrackQuery').value = '';
                    showPlaylistDetails(currentPlaylistId); // Refresh the view
                    showTemporaryMessage(result.message, 'success');
                } else {
                    showTemporaryMessage(result.message || 'Error adding track', 'error');
                }
            } catch (error) {
                console.error('Error adding track:', error);
                showTemporaryMessage('Error adding track', 'error');
            }
        }

        async function playTrackFromPlaylist(trackUri, trackTitle, forcePlay = false) {
            try {
                const endpoint = forcePlay ? 'force-play' : 'add';
                const response = await fetch(`/api/guilds/${guildId}/player/${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query: trackUri })
                });

                const result = await response.json();
                if (result.success) {
                    let message = forcePlay ?
                        `Now force playing: ${trackTitle}` :
                        `Added to queue: ${trackTitle}`;

                    if (result.autoJoined) {
                        message += ' (Bot automatically joined your voice channel)';
                    }

                    // Show success message briefly
                    showTemporaryMessage(message, 'success');
                } else {
                    // Handle specific error messages
                    let errorMessage = result.message || 'Error playing track';
                    if (result.message?.includes('voice channel')) {
                        errorMessage = 'You must be in a voice channel to play music';
                    } else if (result.message?.includes('permission')) {
                        errorMessage = 'Bot doesn\'t have permission to join your voice channel';
                    }
                    showTemporaryMessage(errorMessage, 'error');
                }
            } catch (error) {
                console.error('Error playing track from playlist:', error);
                showTemporaryMessage('Error playing track. Please try again.', 'error');
            }
        }

        async function removeTrackFromPlaylist(trackIndex) {
            if (!currentPlaylistId) return;

            try {
                const response = await fetch(`/api/playlists/${currentPlaylistId}/tracks/${trackIndex}`, {
                    method: 'DELETE'
                });

                const result = await response.json();
                if (response.ok) {
                    showPlaylistDetails(currentPlaylistId); // Refresh the view
                    // No notification needed - the track disappearing from the list is feedback enough
                } else {
                    showTemporaryMessage(result.message || 'Error removing track', 'error');
                }
            } catch (error) {
                console.error('Error removing track:', error);
                showTemporaryMessage('Error removing track', 'error');
            }
        }

        // Helper function to show temporary messages instead of alerts
        function showTemporaryMessage(message, type = 'info') {
            // Remove any existing message
            const existingMessage = document.getElementById('temp-message');
            if (existingMessage) {
                existingMessage.remove();
            }

            // Create new message element
            const messageDiv = document.createElement('div');
            messageDiv.id = 'temp-message';
            messageDiv.className = `fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg transition-all duration-300 ${
                type === 'success' ? 'bg-green-500 text-white' :
                type === 'error' ? 'bg-red-500 text-white' :
                'bg-blue-500 text-white'
            }`;
            messageDiv.textContent = message;

            // Add to page
            document.body.appendChild(messageDiv);

            // Auto-remove after 3 seconds
            setTimeout(() => {
                if (messageDiv) {
                    messageDiv.style.opacity = '0';
                    setTimeout(() => messageDiv.remove(), 300);
                }
            }, 3000);
        }

        async function loadCurrentPlaylist() {
            if (!currentPlaylistId) return;

            try {
                const response = await fetch(`/api/guilds/${guildId}/playlists/${currentPlaylistId}/load`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ shuffle: false })
                });

                const result = await response.json();
                if (result.success) {
                    hidePlaylistDetailsModal();
                    // Queue will be updated via Socket.IO
                    let message = result.message;
                    if (result.autoJoined) {
                        message += ' (Bot automatically joined your voice channel)';
                    }
                    showTemporaryMessage(message, 'success');
                } else {
                    // Handle specific error messages
                    let errorMessage = result.message || 'Error loading playlist';
                    if (response.status === 400 && result.message?.includes('voice channel')) {
                        showTemporaryMessage('You must be in a voice channel to load a playlist', 'error');
                    } else if (response.status === 403 && result.message?.includes('permission')) {
                        showTemporaryMessage('Bot doesn\'t have permission to join your voice channel', 'error');
                    } else {
                        showTemporaryMessage(errorMessage, 'error');
                    }
                }
            } catch (error) {
                console.error('Error loading playlist:', error);
                showTemporaryMessage('Error loading playlist. Please try again.', 'error');
            }
        }



        function getSourceIcon(source) {
            const sourceIcons = {
                'youtube': '<span class="text-xs text-red-500">🔴</span>',
                'youtubemusic': '<span class="text-xs text-red-500">🎵</span>',
                'soundcloud': '<span class="text-xs text-orange-500">🟠</span>',
                'spotify': '<span class="text-xs text-green-500">🟢</span>'
            };
            return sourceIcons[source] || '<span class="text-xs text-gray-500">🎵</span>';
        }

        // Load user preferences and set up source change handlers
        async function loadUserPreferences() {
            try {
                const response = await fetch('/api/search/sources');
                const data = await response.json();

                // Set default source in both selectors
                const mainSelector = document.getElementById('search-source-select');
                const playlistSelector = document.getElementById('playlist-search-source-select');

                if (mainSelector && data.default) {
                    mainSelector.value = data.default;
                }
                if (playlistSelector && data.default) {
                    playlistSelector.value = data.default;
                }

                // Add change handlers to sync preferences
                if (mainSelector) {
                    mainSelector.addEventListener('change', async (e) => {
                        await updateUserPreferredSource(e.target.value);
                        // Sync with playlist selector
                        if (playlistSelector) {
                            playlistSelector.value = e.target.value;
                        }
                    });
                }

                if (playlistSelector) {
                    playlistSelector.addEventListener('change', async (e) => {
                        await updateUserPreferredSource(e.target.value);
                        // Sync with main selector
                        if (mainSelector) {
                            mainSelector.value = e.target.value;
                        }
                    });
                }
            } catch (error) {
                console.error('Error loading user preferences:', error);
            }
        }

        // Update user's preferred source
        async function updateUserPreferredSource(source) {
            try {
                await fetch('/api/search/source', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ source })
                });
            } catch (error) {
                console.error('Error updating user preference:', error);
            }
        }

        // Handle create playlist form submission
        document.getElementById('createPlaylistForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('playlistName').value;
            const description = document.getElementById('playlistDescription').value;
            const includeQueue = document.getElementById('includeCurrentQueue').checked;
            const makePrivate = document.getElementById('makePlaylistPrivate').checked;
            const isPublic = !makePrivate; // Invert: unchecked = public (default), checked = private

            let tracks = [];

            if (includeQueue) {
                try {
                    const response = await fetch(`/api/guilds/${guildId}/queue/full`);
                    const queueData = await response.json();
                    tracks = queueData.tracks || [];
                } catch (error) {
                    console.error('Error getting queue for playlist:', error);
                }
            }

            try {
                const response = await fetch('/api/playlists', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name,
                        description,
                        tracks,
                        isPublic
                    })
                });

                if (response.ok) {
                    hideCreatePlaylistModal();
                    loadPlaylists(); // Refresh playlists list
                    showTemporaryMessage('Playlist created successfully!', 'success');
                } else {
                    const error = await response.json();
                    showTemporaryMessage(error.message || 'Error creating playlist', 'error');
                }
            } catch (error) {
                console.error('Error creating playlist:', error);
                showTemporaryMessage('Error creating playlist', 'error');
            }
        });

        // Handle import playlist form submission
        document.getElementById('importPlaylistForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const url = document.getElementById('importUrl').value;
            const name = document.getElementById('importName').value;
            const description = document.getElementById('importDescription').value;
            const makePrivate = document.getElementById('makeImportPrivate').checked;
            const isPublic = !makePrivate; // Invert: unchecked = public (default), checked = private

            try {
                const response = await fetch('/api/playlists/import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        url,
                        name: name || undefined,
                        description: description || undefined,
                        isPublic
                    })
                });

                const result = await response.json();
                if (response.ok) {
                    hideImportPlaylistModal();
                    loadPlaylists(); // Refresh playlists list
                    showTemporaryMessage(result.message, 'success');
                } else {
                    showTemporaryMessage(result.message || 'Error importing playlist', 'error');
                }
            } catch (error) {
                console.error('Error importing playlist:', error);
                showTemporaryMessage('Error importing playlist', 'error');
            }
        });

        // Search autocomplete functionality
        let searchTimeout = null;
        let selectedSuggestionIndex = -1;
        let currentSuggestions = [];

        function setupSearchAutocomplete(inputId, suggestionsId) {
            const input = document.getElementById(inputId);
            const suggestionsContainer = document.getElementById(suggestionsId);

            input.addEventListener('input', (e) => {
                const query = e.target.value.trim();

                if (query.length < 2) {
                    hideSuggestions(suggestionsContainer);
                    return;
                }

                // Debounce search requests
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    fetchSearchSuggestions(query, suggestionsContainer, inputId);
                }, 300);
            });

            input.addEventListener('keydown', async (e) => {
                const suggestions = suggestionsContainer.querySelectorAll('.search-suggestion');

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
                    updateSuggestionSelection(suggestions);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
                    updateSuggestionSelection(suggestions);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
                        await selectSuggestion(suggestions[selectedSuggestionIndex], input, suggestionsContainer);
                    } else {
                        // If no suggestion selected, trigger the appropriate action
                        if (inputId === 'search-input') {
                            await addTrack();
                        } else if (inputId === 'addTrackQuery') {
                            addTrackToPlaylist();
                        }
                    }
                } else if (e.key === 'Escape') {
                    hideSuggestions(suggestionsContainer);
                }
            });

            // Hide suggestions when clicking outside
            document.addEventListener('click', (e) => {
                if (!input.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                    hideSuggestions(suggestionsContainer);
                }
            });
        }

        async function fetchSearchSuggestions(query, suggestionsContainer, inputId) {
            try {
                // Show loading state
                suggestionsContainer.innerHTML = '<div class="p-3 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Searching...</div>';
                suggestionsContainer.classList.remove('hidden');

                // Determine which source selector to use based on input
                let selectedSource = 'youtubemusic'; // default
                if (inputId === 'search-input') {
                    selectedSource = document.getElementById('search-source-select').value;
                } else if (inputId === 'addTrackQuery') {
                    selectedSource = document.getElementById('playlist-search-source-select').value;
                }

                const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}&source=${encodeURIComponent(selectedSource)}`);
                const data = await response.json();

                currentSuggestions = data.suggestions || [];
                displaySuggestions(currentSuggestions, suggestionsContainer);
            } catch (error) {
                console.error('Error fetching search suggestions:', error);
                hideSuggestions(suggestionsContainer);
            }
        }

        function displaySuggestions(suggestions, container) {
            if (suggestions.length === 0) {
                hideSuggestions(container);
                return;
            }

            container.innerHTML = '';
            selectedSuggestionIndex = -1;

            suggestions.forEach((suggestion, index) => {
                const suggestionElement = document.createElement('div');
                suggestionElement.className = 'search-suggestion p-3 flex items-center space-x-3 border-b border-gray-100 last:border-b-0';
                suggestionElement.dataset.index = index;

                const thumbnail = suggestion.thumbnail ?
                    `<img src="${suggestion.thumbnail}" alt="Thumbnail" class="suggestion-thumbnail bg-gray-200">` :
                    `<div class="suggestion-thumbnail bg-gray-200 flex items-center justify-center"><i class="fas fa-music text-gray-400"></i></div>`;

                suggestionElement.innerHTML = `
                    ${thumbnail}
                    <div class="suggestion-content">
                        <div class="suggestion-title">${escapeHtml(suggestion.title)}</div>
                        <div class="suggestion-author">${escapeHtml(suggestion.author)}</div>
                    </div>
                    <div class="suggestion-duration">${formatDuration(suggestion.duration)}</div>
                `;

                suggestionElement.addEventListener('click', () => {
                    const input = container.previousElementSibling;
                    selectSuggestion(suggestionElement, input, container);
                });

                container.appendChild(suggestionElement);
            });

            container.classList.remove('hidden');
        }

        async function selectSuggestion(suggestionElement, input, container) {
            const index = parseInt(suggestionElement.dataset.index);
            const suggestion = currentSuggestions[index];

            if (suggestion) {
                input.value = suggestion.uri; // Use the URI for direct play
                input.dataset.selectedTitle = suggestion.displayName; // Store display name for UI
                hideSuggestions(container);

                // Trigger the appropriate action based on which input was used
                if (input.id === 'search-input') {
                    await addTrack();
                } else if (input.id === 'addTrackQuery') {
                    addTrackToPlaylist();
                }
            }
        }

        function updateSuggestionSelection(suggestions) {
            suggestions.forEach((suggestion, index) => {
                if (index === selectedSuggestionIndex) {
                    suggestion.classList.add('selected');
                } else {
                    suggestion.classList.remove('selected');
                }
            });
        }

        function hideSuggestions(container) {
            container.classList.add('hidden');
            container.innerHTML = '';
            selectedSuggestionIndex = -1;
        }

        // Advanced Settings Functions
        let currentSettings = {
            '247': false,
            autoplay: false,
            volume: 50
        };

        async function loadAdvancedSettings() {
            try {
                const response = await fetch(`/api/guilds/${guildId}/settings`);
                if (response.ok) {
                    currentSettings = await response.json();
                    updateAdvancedSettingsUI();
                }
            } catch (error) {
                console.error('Error loading advanced settings:', error);
            }
        }

        function updateAdvancedSettingsUI() {
            // Update 24/7 mode button
            const mode247Btn = document.getElementById('mode-247-btn');
            const mode247Text = document.getElementById('mode-247-text');

            if (currentSettings['247']) {
                mode247Btn.className = 'bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm';
                mode247Text.textContent = 'On';
            } else {
                mode247Btn.className = 'bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm';
                mode247Text.textContent = 'Off';
            }

            // Update autoplay button
            const autoplayBtn = document.getElementById('autoplay-btn');
            const autoplayText = document.getElementById('autoplay-text');

            if (currentSettings.autoplay) {
                autoplayBtn.className = 'bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm';
                autoplayText.textContent = 'On';
            } else {
                autoplayBtn.className = 'bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm';
                autoplayText.textContent = 'Off';
            }
        }

        async function toggle247Mode() {
            try {
                const newState = !currentSettings['247'];
                const response = await fetch(`/api/guilds/${guildId}/settings/247`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: newState })
                });

                if (response.ok) {
                    const result = await response.json();
                    currentSettings['247'] = result.enabled;
                    updateAdvancedSettingsUI();

                    if (result.enabled) {
                        showTemporaryMessage('24/7 Mode enabled - Bot will stay in voice channel', 'success');
                    } else {
                        showTemporaryMessage('24/7 Mode disabled - Bot will leave when queue is empty', 'success');
                    }
                }
            } catch (error) {
                console.error('Error toggling 24/7 mode:', error);
            }
        }

        async function toggleAutoplay() {
            try {
                const newState = !currentSettings.autoplay;
                const response = await fetch(`/api/guilds/${guildId}/settings/autoplay`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: newState })
                });

                if (response.ok) {
                    const result = await response.json();
                    currentSettings.autoplay = result.enabled;
                    updateAdvancedSettingsUI();

                    if (result.enabled) {
                        showTemporaryMessage('Autoplay enabled - Similar tracks will play when queue ends', 'success');
                    } else {
                        showTemporaryMessage('Autoplay disabled - Playback will stop when queue ends', 'success');
                    }
                }
            } catch (error) {
                console.error('Error toggling autoplay:', error);
            }
        }

        // Audio Filters Functions
        let currentFilters = {
            bassboost: 'off',
            rotation: false,
            karaoke: false,
            vibrato: false,
            tremolo: false,
            lowpass: false,
            nightcore: false,
            pitch: 1,
            speed: 1
        };

        async function loadFilterStatus() {
            try {
                const response = await fetch(`/api/guilds/${guildId}/filters/status`);
                if (response.ok) {
                    currentFilters = await response.json();
                    updateFilterUI();
                }
            } catch (error) {
                console.error('Error loading filter status:', error);
            }
        }

        function updateFilterUI() {
            // Update bass boost buttons
            document.querySelectorAll('.bass-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(`bass-${currentFilters.bassboost}`).classList.add('active');

            // Update toggle filter buttons
            const filterButtons = {
                '8d': currentFilters.rotation,
                'nightcore': currentFilters.nightcore,
                'karaoke': currentFilters.karaoke,
                'vibrato': currentFilters.vibrato,
                'tremolo': currentFilters.tremolo,
                'lowpass': currentFilters.lowpass
            };

            Object.entries(filterButtons).forEach(([filter, enabled]) => {
                const btn = document.getElementById(`filter-${filter}`);
                if (enabled) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            // Update sliders
            document.getElementById('pitch-slider').value = currentFilters.pitch;
            document.getElementById('pitch-value').textContent = currentFilters.pitch.toFixed(1);
            document.getElementById('speed-slider').value = currentFilters.speed;
            document.getElementById('speed-value').textContent = currentFilters.speed.toFixed(1);
        }

        async function setBassBoost(level) {
            try {
                const response = await fetch(`/api/guilds/${guildId}/filters/bassboost`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ level })
                });

                if (response.ok) {
                    const result = await response.json();
                    currentFilters.bassboost = result.level;
                    updateFilterUI();
                }
            } catch (error) {
                console.error('Error setting bass boost:', error);
            }
        }

        async function toggleFilter(filterType) {
            try {
                const response = await fetch(`/api/guilds/${guildId}/filters/toggle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filter: filterType })
                });

                if (response.ok) {
                    const result = await response.json();
                    // Map 8d filter to rotation property for consistency
                    if (filterType === '8d') {
                        currentFilters.rotation = result.enabled;
                    } else {
                        currentFilters[filterType] = result.enabled;
                    }
                    updateFilterUI();
                }
            } catch (error) {
                console.error('Error toggling filter:', error);
            }
        }

        async function setPitch(pitch) {
            try {
                const response = await fetch(`/api/guilds/${guildId}/filters/pitch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pitch: parseFloat(pitch) })
                });

                if (response.ok) {
                    currentFilters.pitch = parseFloat(pitch);
                    document.getElementById('pitch-value').textContent = pitch;
                }
            } catch (error) {
                console.error('Error setting pitch:', error);
            }
        }

        async function setSpeed(speed) {
            try {
                const response = await fetch(`/api/guilds/${guildId}/filters/speed`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ speed: parseFloat(speed) })
                });

                if (response.ok) {
                    currentFilters.speed = parseFloat(speed);
                    document.getElementById('speed-value').textContent = speed;
                }
            } catch (error) {
                console.error('Error setting speed:', error);
            }
        }

        async function resetFilters() {

            try {
                const response = await fetch(`/api/guilds/${guildId}/filters/reset`, {
                    method: 'POST'
                });

                if (response.ok) {
                    // Reset to default values
                    currentFilters = {
                        bassboost: 'off',
                        rotation: false,
                        karaoke: false,
                        vibrato: false,
                        tremolo: false,
                        lowpass: false,
                        nightcore: false,
                        pitch: 1,
                        speed: 1
                    };
                    updateFilterUI();
                    showTemporaryMessage('All filters have been reset!', 'success');
                }
            } catch (error) {
                console.error('Error resetting filters:', error);
            }
        }

        // TTS Functions
        let currentTTSProvider = 'flowery'; // Default to FloweryTTS
        let floweryVoices = [];

        // User's hand-picked custom voices from the browser modal
        let customVoices = JSON.parse(localStorage.getItem('tts-custom-voices') || '[]');

        // Initialize TTS system
        async function initTTS() {
            // Load FloweryTTS voices
            await loadFloweryVoices();

            // Set up TTS speed slider
            const speedSlider = document.getElementById('tts-speed-slider');
            if (speedSlider) {
                speedSlider.addEventListener('input', (e) => {
                    document.getElementById('tts-speed-value').textContent = parseFloat(e.target.value).toFixed(1) + 'x';
                });
            }

            // Set up TTS quality selection
            const qualitySelect = document.getElementById('tts-quality');
            if (qualitySelect) {
                // Load saved quality preference
                const savedQuality = localStorage.getItem('tts-quality') || 'aac';
                qualitySelect.value = savedQuality;

                // Save quality preference when changed
                qualitySelect.addEventListener('change', function() {
                    localStorage.setItem('tts-quality', this.value);
                    updateQualityInfo();
                });

                // Update quality info on load
                updateQualityInfo();
            }

            // Set up TTS text clearing preference
            const clearTextCheckbox = document.getElementById('tts-clear-text');
            if (clearTextCheckbox) {
                // Load saved preference (default: false - keep text)
                const shouldClearText = localStorage.getItem('tts-clear-text') === 'true';
                clearTextCheckbox.checked = shouldClearText;

                // Save preference when changed
                clearTextCheckbox.addEventListener('change', function() {
                    localStorage.setItem('tts-clear-text', this.checked);
                });
            }

            // Check TTS service availability
            await checkTTSAvailability();

            // Initialize with FloweryTTS selected (or fallback to DuncteBot if FloweryTTS unavailable)
            const savedProvider = localStorage.getItem('tts-provider') || 'flowery';
            selectTTSProvider(savedProvider);
        }

        // Check TTS service availability
        async function checkTTSAvailability() {
            try {
                // Test FloweryTTS availability
                const floweryResponse = await fetch('/api/tts/flowery/voices', { method: 'HEAD' });
                if (!floweryResponse.ok) {
                    console.warn('FloweryTTS service appears to be unavailable');

                    // If user had FloweryTTS selected but it's unavailable, suggest DuncteBot
                    const savedProvider = localStorage.getItem('tts-provider');
                    if (savedProvider === 'flowery') {
                        showTemporaryMessage('FloweryTTS service unavailable, DuncteBot is available as fallback', 'warning');
                    }
                }
            } catch (error) {
                console.warn('Could not check TTS service availability:', error);
            }
        }

        // Load FloweryTTS voices - curated selection
        async function loadFloweryVoices() {
            const voiceSelect = document.getElementById('tts-voice-select');

            try {
                voiceSelect.innerHTML = '<option value="">Loading voices...</option>';

                // Load all voices and filter on client side
                console.log('Fetching curated voices from API...');
                const response = await fetch('/api/tts/flowery/voices/popular');
                console.log('API response status:', response.status);

                const data = await response.json();
                console.log('API response data:', data);

                if (data.success && data.voices) {
                    console.log(`Received ${data.voices.length} curated voices from API`);
                    floweryVoices = data.voices;
                    populateVoiceSelect();
                } else {
                    throw new Error(`Failed to load voices: ${data.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error loading FloweryTTS voices:', error);
                // Fallback to empty list with error message
                floweryVoices = [];
                voiceSelect.innerHTML = '<option value="">Default Voice (voices unavailable)</option>';

                // Show a subtle warning in the TTS info
                const infoText = document.getElementById('tts-info-text');
                if (infoText && currentTTSProvider === 'flowery') {
                    infoText.textContent = 'FloweryTTS • Voice list unavailable • Will use default voice • English & Czech support • Auto-joins voice channel';
                }
            }
        }

        // Flag emoji lookup helper
        function getLanguageFlag(langCode) {
            const code = (langCode || '').toLowerCase();
            if (code.startsWith('cs') || code.startsWith('cz')) return '🇨🇿';
            if (code.startsWith('en-gb')) return '🇬🇧';
            if (code.startsWith('en-au')) return '🇦🇺';
            if (code.startsWith('en-ca')) return '🇨🇦';
            if (code.startsWith('en')) return '🇺🇸';
            if (code.startsWith('ja')) return '🇯🇵';
            if (code.startsWith('ru')) return '🇷🇺';
            if (code.startsWith('pl')) return '🇵🇱';
            if (code.startsWith('de')) return '🇩🇪';
            if (code.startsWith('fr')) return '🇫🇷';
            if (code.startsWith('es')) return '🇪🇸';
            if (code.startsWith('it')) return '🇮🇹';
            if (code.startsWith('pt')) return '🇵🇹';
            if (code.startsWith('ko')) return '🇰🇷';
            if (code.startsWith('zh')) return '🇨🇳';
            return '🌍';
        }

        function saveCustomVoices() {
            localStorage.setItem('tts-custom-voices', JSON.stringify(customVoices));
        }

        function addCustomVoice(voice) {
            // Deduplicate by id
            if (customVoices.find(v => v.id === voice.id)) return;
            customVoices.unshift(voice); // newest first
            // Cap at 20 to prevent unbounded growth
            if (customVoices.length > 20) customVoices = customVoices.slice(0, 20);
            saveCustomVoices();
        }

        function renderCustomPicksOptgroup(voiceSelect) {
            if (customVoices.length === 0) return;
            const group = document.createElement('optgroup');
            group.label = `⭐ Custom (${customVoices.length})`;
            customVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.id;
                const flag = getLanguageFlag(voice.language.code);
                option.textContent = `${flag} ${voice.name} (${voice.gender})`;
                group.appendChild(option);
            });
            voiceSelect.appendChild(group);
        }

        // Populate voice selection dropdown — language-agnostic, groups by voice.language.name
        function populateVoiceSelect() {
            const voiceSelect = document.getElementById('tts-voice-select');
            if (!voiceSelect) return;

            voiceSelect.innerHTML = '<option value="">🎯 Auto-Select Best Voice</option>';

            // Render user's custom picks first (if any)
            renderCustomPicksOptgroup(voiceSelect);

            if (!floweryVoices || floweryVoices.length === 0) {
                voiceSelect.innerHTML += '<option value="" disabled>No voices available</option>';
                return;
            }

            // Group by language.name (insertion order preserved by Map)
            const byLanguage = new Map();
            for (const voice of floweryVoices) {
                const key = voice.language.name;
                if (!byLanguage.has(key)) byLanguage.set(key, []);
                byLanguage.get(key).push(voice);
            }

            // For each language, add an optgroup with a flag emoji lookup
            for (const [languageName, voices] of byLanguage) {
                const group = document.createElement('optgroup');
                const flag = getLanguageFlag(voices[0].language.code);
                group.label = `${flag} ${languageName} (${voices.length} voices)`;

                voices.sort((a, b) => a.name.localeCompare(b.name)).forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.id;
                    const qualityIcon = voice.name.toLowerCase().includes('neural') ? '🧠 ' : '';
                    option.textContent = `${qualityIcon}${voice.name} (${voice.gender})`;
                    group.appendChild(option);
                });

                voiceSelect.appendChild(group);
            }
        }

        // ============== Voice Browser Modal ==============
        let vbAllVoices = null; // cached on first open
        let vbFiltered = [];

        async function openVoiceBrowser() {
            const modal = document.getElementById('vb-modal');
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');

            if (!vbAllVoices) {
                document.getElementById('vb-loading').classList.remove('hidden');
                document.getElementById('vb-list').innerHTML = '';
                try {
                    const res = await fetch('/api/tts/flowery/voices');
                    const data = await res.json();
                    vbAllVoices = (data && data.success && Array.isArray(data.voices)) ? data.voices : [];
                    populateLanguageFilter();
                } catch (err) {
                    console.error('Voice browser fetch failed:', err);
                    vbAllVoices = [];
                } finally {
                    document.getElementById('vb-loading').classList.add('hidden');
                }
            }
            applyVoiceBrowserFilters();
        }

        function closeVoiceBrowser() {
            const modal = document.getElementById('vb-modal');
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }

        function populateLanguageFilter() {
            const sel = document.getElementById('vb-language');
            // Count voices per language
            const counts = new Map();
            for (const v of vbAllVoices) {
                const n = v.language.name;
                counts.set(n, (counts.get(n) || 0) + 1);
            }
            // Sort by count desc
            const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
            sel.innerHTML = '<option value="">All languages</option>' +
                sorted.map(([name, c]) => `<option value="${name.replace(/"/g, '&quot;')}">${name} (${c})</option>`).join('');
        }

        function applyVoiceBrowserFilters() {
            const q = document.getElementById('vb-search').value.trim().toLowerCase();
            const lang = document.getElementById('vb-language').value;
            const gender = document.querySelector('input[name="vb-gender"]:checked')?.value || '';

            vbFiltered = vbAllVoices.filter(v => {
                if (lang && v.language.name !== lang) return false;
                if (gender && v.gender !== gender) return false;
                if (q) {
                    const haystack = (v.name + ' ' + v.language.name).toLowerCase();
                    if (!haystack.includes(q)) return false;
                }
                return true;
            });

            renderVoiceBrowserList();
        }

        function renderVoiceBrowserList() {
            const list = document.getElementById('vb-list');
            const empty = document.getElementById('vb-empty');
            const countEl = document.getElementById('vb-count');

            countEl.textContent = vbFiltered.length;

            if (vbFiltered.length === 0) {
                list.innerHTML = '';
                empty.classList.remove('hidden');
                return;
            }
            empty.classList.add('hidden');

            // Cap rendering at 200 to keep DOM fast; show a note if more exist
            const shown = vbFiltered.slice(0, 200);
            list.innerHTML = shown.map(v => {
                const flag = getLanguageFlag(v.language.code);
                // escape voice name for safe HTML
                const safeName = v.name.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                return `
                    <button type="button" class="w-full text-left px-4 py-2 hover:bg-blue-50 flex items-center gap-3" data-voice-id="${v.id}">
                        <span class="text-lg">${flag}</span>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium text-gray-900 truncate">${safeName}</div>
                            <div class="text-xs text-gray-500">${v.language.name} · ${v.gender}</div>
                        </div>
                        <span class="text-xs text-blue-600">Add</span>
                    </button>`;
            }).join('');

            if (vbFiltered.length > 200) {
                list.insertAdjacentHTML('beforeend', `<div class="text-center py-3 text-xs text-gray-500">Showing first 200 of ${vbFiltered.length}. Refine filters to see more.</div>`);
            }

            // Wire up clicks (event delegation)
            list.querySelectorAll('button[data-voice-id]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-voice-id');
                    const voice = vbAllVoices.find(v => v.id === id);
                    if (!voice) return;
                    addCustomVoice(voice);
                    closeVoiceBrowser();
                    // Re-render the main dropdown to include the new custom pick
                    populateVoiceSelect();
                    // Select the new voice
                    const select = document.getElementById('tts-voice-select');
                    if (select) select.value = id;
                    showTemporaryMessage(`Added ${voice.name} to your Custom list`, 'success');
                });
            });
        }

        function initVoiceBrowserControls() {
            const openBtn = document.getElementById('open-voice-browser');
            const closeBtn = document.getElementById('vb-close');
            const modal = document.getElementById('vb-modal');
            if (!openBtn || !closeBtn || !modal) return;

            openBtn.addEventListener('click', openVoiceBrowser);
            closeBtn.addEventListener('click', closeVoiceBrowser);
            modal.addEventListener('click', (e) => { if (e.target === modal) closeVoiceBrowser(); });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeVoiceBrowser();
            });

            document.getElementById('vb-search').addEventListener('input', applyVoiceBrowserFilters);
            document.getElementById('vb-language').addEventListener('change', applyVoiceBrowserFilters);
            document.querySelectorAll('input[name="vb-gender"]').forEach(r =>
                r.addEventListener('change', applyVoiceBrowserFilters)
            );
        }

        // Update quality information display
        function updateQualityInfo() {
            const qualitySelect = document.getElementById('tts-quality');
            const quality = qualitySelect?.value || 'mp3';
            const qualityInfo = getQualityInfo(quality);

            // Update the info text to include quality information
            const infoText = document.getElementById('tts-info-text');
            if (infoText && currentTTSProvider === 'flowery') {
                infoText.textContent = `FloweryTTS • ${qualityInfo.name} quality • English, Czech & Japanese voices • Auto-joins voice channel`;
            }
        }

        // Get quality information
        function getQualityInfo(format) {
            const qualityMap = {
                'aac': { name: 'Good', size: 'Small', description: 'Efficient compression, good quality' },
                'ogg_opus': { name: 'High', size: 'Medium', description: 'Modern codec, excellent quality' },
                'flac': { name: 'Lossless', size: 'Large', description: 'Perfect quality, larger files' }
            };
            return qualityMap[format] || qualityMap['aac'];
        }

        // Select TTS provider
        function selectTTSProvider(provider) {
            currentTTSProvider = provider;

            const floweryBtn = document.getElementById('tts-provider-flowery');
            const duncteBtn = document.getElementById('tts-provider-duncte');
            const floweryOptions = document.getElementById('flowery-options');
            const duncteInfo = document.getElementById('duncte-info');
            const charLimit = document.getElementById('tts-char-limit');
            const textArea = document.getElementById('tts-text');
            const infoText = document.getElementById('tts-info-text');

            if (provider === 'flowery') {
                // Update button styles
                floweryBtn.className = 'flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center';
                duncteBtn.className = 'flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center';

                // Show/hide options
                floweryOptions.classList.remove('hidden');
                duncteInfo.classList.add('hidden');

                // Update character limit
                charLimit.textContent = '2048';
                textArea.maxLength = 2048;
                textArea.placeholder = 'Enter text to speak (max 2048 characters)...';

                // Update info text with quality info
                updateQualityInfo();
            } else {
                // Update button styles
                duncteBtn.className = 'flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center';
                floweryBtn.className = 'flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center';

                // Show/hide options
                floweryOptions.classList.add('hidden');
                duncteInfo.classList.remove('hidden');

                // Update character limit
                charLimit.textContent = '200';
                textArea.maxLength = 200;
                textArea.placeholder = 'Enter text to speak (max 200 characters)...';

                // Update info text
                infoText.textContent = 'DuncteBot TTS • Czech language • Auto-joins voice channel';
            }

            // Update character count display
            updateTTSCharCount();

            // Save preference
            localStorage.setItem('tts-provider', provider);
        }

        async function speakText() {
            const textArea = document.getElementById('tts-text');
            const speakBtn = document.getElementById('tts-speak-btn');
            const btnText = document.getElementById('tts-btn-text');
            const text = textArea.value.trim();

            if (!text) {
                showTemporaryMessage('Please enter some text to speak', 'error');
                return;
            }

            const maxLength = currentTTSProvider === 'flowery' ? 2048 : 200;
            if (text.length > maxLength) {
                showTemporaryMessage(`Text must be ${maxLength} characters or less`, 'error');
                return;
            }

            // Update button state
            speakBtn.disabled = true;
            btnText.textContent = 'Speaking...';
            speakBtn.classList.add('opacity-50');

            try {
                let response, requestBody;
                let usedFallback = false;

                if (currentTTSProvider === 'flowery') {
                    // FloweryTTS request
                    const voice = document.getElementById('tts-voice-select').value;
                    const speed = parseFloat(document.getElementById('tts-speed-slider').value);
                    const translate = document.getElementById('tts-translate').checked;
                    const quality = document.getElementById('tts-quality').value;

                    requestBody = {
                        text,
                        voice: voice || undefined,
                        speed: speed !== 1.0 ? speed : undefined,
                        translate: translate || undefined,
                        audio_format: quality || 'mp3'
                    };

                    try {
                        response = await fetch(`/api/guilds/${guildId}/tts/flowery`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestBody)
                        });

                        // If FloweryTTS fails and text is short enough, try DuncteBot fallback
                        if (!response.ok && text.length <= 200) {
                            console.warn('FloweryTTS failed, attempting DuncteBot fallback...');
                            btnText.textContent = 'Retrying with DuncteBot...';

                            response = await fetch(`/api/guilds/${guildId}/tts/speak`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ text })
                            });
                            usedFallback = true;
                        }
                    } catch (floweryError) {
                        // Network error with FloweryTTS, try DuncteBot if text is short enough
                        if (text.length <= 200) {
                            console.warn('FloweryTTS network error, attempting DuncteBot fallback...', floweryError);
                            btnText.textContent = 'Retrying with DuncteBot...';

                            response = await fetch(`/api/guilds/${guildId}/tts/speak`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ text })
                            });
                            usedFallback = true;
                        } else {
                            throw floweryError;
                        }
                    }
                } else {
                    // DuncteBot TTS request
                    response = await fetch(`/api/guilds/${guildId}/tts/speak`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text })
                    });
                }

                const result = await response.json();

                if (response.ok && result.success) {
                    let message = result.message;
                    if (usedFallback) {
                        message += ' (used DuncteBot fallback)';
                    }
                    showTemporaryMessage(message, 'success');

                    // Check user preference for text clearing
                    const shouldClearText = localStorage.getItem('tts-clear-text') === 'true';
                    if (shouldClearText) {
                        textArea.value = '';
                        updateTTSCharCount();
                    } else {
                        // Select all text for easy replacement/editing
                        textArea.select();
                    }

                    // Queue will be updated automatically via Socket.IO real-time events
                    // No manual refresh needed
                } else {
                    throw new Error(result.error || 'TTS failed');
                }
            } catch (error) {
                console.error('TTS Error:', error);
                showTemporaryMessage(`TTS failed: ${error.message}`, 'error');
            } finally {
                // Reset button state
                speakBtn.disabled = false;
                btnText.textContent = 'Speak';
                speakBtn.classList.remove('opacity-50');
            }
        }

        function clearTTSText() {
            document.getElementById('tts-text').value = '';
            updateTTSCharCount();
        }

        function updateTTSCharCount() {
            const textArea = document.getElementById('tts-text');
            const charCount = document.getElementById('tts-char-count');
            const charLimit = document.getElementById('tts-char-limit');
            const currentLength = textArea.value.length;
            const maxLength = parseInt(charLimit.textContent);

            charCount.textContent = currentLength;

            // Change color based on character count percentage
            const percentage = currentLength / maxLength;
            if (percentage > 0.9) {
                charCount.style.color = '#ef4444'; // red
            } else if (percentage > 0.75) {
                charCount.style.color = '#f59e0b'; // yellow
            } else {
                charCount.style.color = '#9ca3af'; // gray
            }
        }

        // Logout function
        async function logout() {
            try {
                await fetch('/auth/logout', { method: 'POST' });
                window.location.href = '/';
            } catch (error) {
                console.error('Logout error:', error);
            }
        }

        // Dark mode toggle functionality
        function initDarkMode() {
            const darkModeToggle = document.getElementById('darkModeToggle');
            const moonIcon = document.getElementById('moonIcon');
            const sunIcon = document.getElementById('sunIcon');
            const html = document.documentElement;

            // Check for saved theme preference or default to dark mode
            const savedTheme = localStorage.getItem('theme') || 'dark';

            function setTheme(isDark) {
                if (isDark) {
                    html.classList.add('dark');
                    moonIcon.style.display = 'none';
                    sunIcon.style.display = 'inline';
                } else {
                    html.classList.remove('dark');
                    moonIcon.style.display = 'inline';
                    sunIcon.style.display = 'none';
                }
            }

            // Initialize theme
            setTheme(savedTheme === 'dark');

            darkModeToggle.addEventListener('click', () => {
                const isDark = !html.classList.contains('dark');
                setTheme(isDark);
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
            });
        }

        // Initialize on page load
        document.addEventListener('DOMContentLoaded', async () => {
            initGuildDashboard();
            initDarkMode();

            // Initialize TTS system
            await initTTS();
            initVoiceBrowserControls();

            // Setup search autocomplete for both search inputs
            setupSearchAutocomplete('search-input', 'search-suggestions');
            setupSearchAutocomplete('addTrackQuery', 'playlist-search-suggestions');

            // Setup filter sliders
            const pitchSlider = document.getElementById('pitch-slider');
            const speedSlider = document.getElementById('speed-slider');

            pitchSlider.addEventListener('input', (e) => {
                document.getElementById('pitch-value').textContent = parseFloat(e.target.value).toFixed(1);
            });

            pitchSlider.addEventListener('change', (e) => {
                setPitch(e.target.value);
            });

            speedSlider.addEventListener('input', (e) => {
                document.getElementById('speed-value').textContent = parseFloat(e.target.value).toFixed(1);
            });

            speedSlider.addEventListener('change', (e) => {
                setSpeed(e.target.value);
            });

            // Setup TTS character counter
            const ttsTextArea = document.getElementById('tts-text');

            if (ttsTextArea) {
                ttsTextArea.addEventListener('input', updateTTSCharCount);

                // Allow Enter key to trigger TTS (Shift+Enter for new line)
                ttsTextArea.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        speakText();
                    }
                });
            }

            // Load saved TTS provider preference
            const savedProvider = localStorage.getItem('tts-provider') || 'flowery';
            selectTTSProvider(savedProvider);
        });
