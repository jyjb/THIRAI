/**
 * Injects a massive, near-fullscreen floating window to view ANY supported Blob.
 * @param {Blob} blob - The Blob object
 * @param {string} fileName - Optional: Used for the header title and download fallback
 **/
function getExtension(filename) {
    return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}

function createFloatingBlobViewer(blob, fileName = 'Document Viewer') {
    let blobUrl;
    let fileExt = getExtension(fileName);

    console.log(fileExt);


    blobUrl = URL.createObjectURL(blob);
    // 1. Create the massive floating container
    const floatContainer = document.createElement('div');
    floatContainer.id = 'floating-blob-viewer-' + Date.now();
    Object.assign(floatContainer.style, {
        position: 'fixed',
        top: '2vh',       /* 2% from the top */
        left: '2vw',      /* 2% from the left */
        width: '96vw',    /* Takes up 96% of the screen width */
        height: '96vh',   /* Takes up 96% of the screen height */
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        zIndex: '999999',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #c1c7d0',
        resize: 'both',
        overflow: 'hidden',
        fontFamily: 'sans-serif'
    });

    // 2. Create the draggable header
    const header = document.createElement('div');
    Object.assign(header.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px',
        backgroundColor: '#002449',
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: '1rem',
        cursor: 'move',
        userSelect: 'none'
    });
    header.innerText = fileName;

    // 3. Create the Close button & Memory Cleanup
    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✖ Close';
    Object.assign(closeBtn.style, {
        background: '#de350b',
        border: 'none',
        color: '#ffffff',
        cursor: 'pointer',
        fontSize: '0.9rem',
        padding: '6px 12px',
        borderRadius: '4px',
        fontWeight: 'bold'
    });

    closeBtn.onclick = () => {
        document.body.removeChild(floatContainer);
        URL.revokeObjectURL(blobUrl);
    };

    header.appendChild(closeBtn);

    // 4. Create the Content Area
    const contentArea = document.createElement('div');
    Object.assign(contentArea.style, {
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
        backgroundColor: '#f4f5f7'
    });

    // 5. SMART RENDERING LOGIC
    const type = blob.type.toLowerCase();

    console.log(type);

    if (type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = blobUrl;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        contentArea.appendChild(img);

    } else if (type.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = blobUrl;
        video.controls = true;
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100%';
        contentArea.appendChild(video);

    } else if (type.startsWith('audio/')) {
        const audio = document.createElement('audio');
        audio.src = blobUrl;
        audio.controls = true;
        contentArea.appendChild(audio);

    } else if (type === 'application/pdf' || type.startsWith('text/')) {
        const iframe = document.createElement('iframe');
        iframe.src = blobUrl;
        Object.assign(iframe.style, {
            width: '100%', height: '100%', border: 'none'
        });
        contentArea.appendChild(iframe);

    } else {
        const msg = document.createElement('p');
        msg.innerText = `Preview not available for ${type || 'this file type'}.`;
        msg.style.color = '#5e6c84';

        const dlBtn = document.createElement('button');
        dlBtn.innerText = 'Download File Instead';
        Object.assign(dlBtn.style, {
            padding: '10px 20px', backgroundColor: '#1E90FF', color: 'white',
            border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
        });

        dlBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = fileName;
            a.click();
        };

        contentArea.appendChild(msg);
        contentArea.appendChild(dlBtn);
    }

    // 6. Dragging Mechanics
    let isDragging = false, startX, startY, initialLeft, initialTop;

    header.onmousedown = (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = floatContainer.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
    };

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        floatContainer.style.left = (initialLeft + (e.clientX - startX)) + 'px';
        floatContainer.style.top = (initialTop + (e.clientY - startY)) + 'px';
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    // 7. Assemble and Inject
    floatContainer.appendChild(header);
    floatContainer.appendChild(contentArea);
    document.body.appendChild(floatContainer);
}