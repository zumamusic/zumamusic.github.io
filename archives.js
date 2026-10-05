(() => {
  const mediaBase = 'archive-media/archives-1/';

  // Add future event or season folders here; each collection appears in the tree.
  const collections = [
    {
      id: 'archives-1',
      name: 'Archives 1',
      files: [
        'IMG_4451.jpeg', 'IMG_4714.jpeg', 'IMG_4955.MOV', 'IMG_5196.JPG',
        'IMG_4600.jpeg', 'IMG_4942.JPG', 'IMG_4455.jpeg',
        'IMG_4065.jpeg', 'IMG_4533.JPG'
      ].map(name => {
        const stem = name.slice(0, name.lastIndexOf('.'));
        const video = name.toLowerCase().endsWith('.mov');
        return {
          name,
          type: video ? 'video' : 'image',
          thumb: `${mediaBase}thumbs/${stem}${video ? '-poster.jpg' : '.webp'}`,
          src: `${mediaBase}${video ? `${stem}.mp4` : `full/${stem}.webp`}`
        };
      })
    }
  ];

  const layer = document.querySelector('#archives-layer');
  const windowEl = document.querySelector('#archives-window');
  const dockButton = document.querySelector('#dock-archives-trigger');
  const rootToggle = document.querySelector('#archives-root-toggle');
  const rootSelect = document.querySelector('#archives-root-select');
  const treeChildren = document.querySelector('#archives-tree-children');
  const grid = document.querySelector('#archives-grid');
  const viewer = document.querySelector('#archives-viewer');
  const explorer = document.querySelector('.archives-explorer');
  const viewerMedia = document.querySelector('#archives-viewer-media');
  const filmstrip = document.querySelector('#archives-filmstrip');
  let currentFolder = 'root';
  let currentIndex = 0;
  let lastMediaButton = null;

  const activeCollection = () => collections.find(folder => folder.id === currentFolder);

  function setRootExpanded(expanded) {
    treeChildren.hidden = !expanded;
    rootToggle.textContent = expanded ? '−' : '+';
    rootToggle.setAttribute('aria-expanded', String(expanded));
    rootToggle.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} LA Archives`);
  }

  function renderTree() {
    treeChildren.replaceChildren();
    collections.forEach(folder => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'archives-tree-folder archives-tree-child';
      button.dataset.folder = folder.id;
      button.innerHTML = '<img src="archive-folder.png" alt="">';
      button.append(document.createTextNode(folder.name));
      button.addEventListener('click', () => selectFolder(folder.id));
      treeChildren.append(button);
    });
    updateTreeSelection();
  }

  function updateTreeSelection() {
    windowEl.querySelectorAll('.archives-tree-folder').forEach(button => {
      const active = button.dataset.folder === currentFolder;
      button.classList.toggle('is-selected', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function renderContent() {
    grid.replaceChildren();
    const folder = activeCollection();
    document.querySelector('#archives-current-folder').textContent = folder?.name ?? 'LA_Archives';
    document.querySelector('#archives-address').textContent = folder ? `LA_Archives / ${folder.name}` : 'LA_Archives';
    const count = folder ? folder.files.length : collections.length;
    document.querySelector('#archives-item-count').textContent = `${count} ${folder ? (count === 1 ? 'file' : 'files') : (count === 1 ? 'folder' : 'folders')}`;
    document.querySelector('#archives-status').textContent = `${count} object${count === 1 ? '' : 's'}`;

    if (!folder) {
      collections.forEach(collection => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'archives-folder-card';
        button.innerHTML = '<img src="archive-folder.png" alt="">';
        const label = document.createElement('span');
        label.textContent = collection.name;
        button.append(label);
        button.addEventListener('click', () => selectFolder(collection.id));
        grid.append(button);
      });
      return;
    }

    folder.files.forEach((file, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `archives-file-card${file.type === 'video' ? ' is-video' : ''}`;
      button.setAttribute('aria-label', `${file.type === 'video' ? 'Play video' : 'View photo'} ${file.name}`);
      const preview = document.createElement('span');
      preview.className = 'archives-file-preview';
      const image = document.createElement('img');
      image.src = file.thumb;
      image.alt = '';
      image.loading = index < 4 ? 'eager' : 'lazy';
      preview.append(image);
      if (file.type === 'video') {
        const play = document.createElement('span');
        play.className = 'archives-play-icon';
        play.setAttribute('aria-hidden', 'true');
        preview.append(play);
      }
      const name = document.createElement('span');
      name.className = 'archives-file-name';
      name.textContent = file.name;
      const type = document.createElement('span');
      type.className = 'archives-file-type';
      type.textContent = file.type === 'video' ? 'MOVIE · PLAY' : 'PHOTO';
      button.append(preview, name, type);
      button.addEventListener('click', () => {
        lastMediaButton = button;
        openViewer(index);
      });
      grid.append(button);
    });
  }

  function selectFolder(id) {
    closeViewer(false);
    currentFolder = id;
    if (id !== 'root' && treeChildren.hidden) setRootExpanded(true);
    updateTreeSelection();
    renderContent();
  }

  function renderViewer(autoplayVideo = false) {
    const files = activeCollection().files;
    const file = files[currentIndex];
    viewerMedia.replaceChildren();
    document.querySelector('#archives-viewer-index').textContent = `${currentIndex + 1} / ${files.length}`;
    document.querySelector('#archives-viewer-caption').textContent = file.name;

    if (file.type === 'video') {
      const video = document.createElement('video');
      video.src = file.src;
      video.poster = file.thumb;
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.setAttribute('aria-label', file.name);
      viewerMedia.append(video);
      if (autoplayVideo) video.play().catch(() => {});
    } else {
      const image = document.createElement('img');
      image.src = file.src;
      image.alt = file.name;
      viewerMedia.append(image);
    }

    filmstrip.replaceChildren();
    files.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `archives-filmstrip-item${index === currentIndex ? ' is-active' : ''}`;
      button.setAttribute('aria-label', `Show ${item.name}`);
      button.setAttribute('aria-pressed', String(index === currentIndex));
      const image = document.createElement('img');
      image.src = item.thumb;
      image.alt = '';
      button.append(image);
      if (item.type === 'video') {
        const play = document.createElement('span');
        play.className = 'archives-filmstrip-play';
        play.setAttribute('aria-hidden', 'true');
        button.append(play);
      }
      button.addEventListener('click', () => {
        showMedia(index, item.type === 'video');
        filmstrip.children[index]?.focus();
      });
      filmstrip.append(button);
    });
    filmstrip.children[currentIndex]?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  function openViewer(index) {
    currentIndex = index;
    viewer.hidden = false;
    explorer.inert = true;
    renderViewer(activeCollection().files[index].type === 'video');
    document.querySelector('#archives-viewer-back').focus();
  }

  function closeViewer(restoreFocus = true) {
    if (viewer.hidden) return;
    viewerMedia.querySelector('video')?.pause();
    viewer.hidden = true;
    explorer.inert = false;
    viewerMedia.replaceChildren();
    if (restoreFocus) lastMediaButton?.focus();
  }

  function showMedia(index, autoplayVideo = false) {
    viewerMedia.querySelector('video')?.pause();
    const length = activeCollection().files.length;
    currentIndex = (index + length) % length;
    renderViewer(autoplayVideo);
  }

  function openArchives() {
    window.ZumaWindowManager?.open('archives');
    renderContent();
    requestAnimationFrame(() => document.querySelector('#archives-close').focus());
  }

  function closeArchives() {
    closeViewer(false);
    window.ZumaWindowManager?.close('archives');
    currentFolder = 'root';
    setRootExpanded(false);
    updateTreeSelection();
    renderContent();
    dockButton.focus();
  }

  rootToggle.addEventListener('click', () => {
    const expanded = treeChildren.hidden;
    setRootExpanded(expanded);
    if (!expanded) selectFolder('root');
  });
  rootSelect.addEventListener('click', () => selectFolder('root'));
  dockButton.addEventListener('click', openArchives);
  document.querySelector('#archives-close').addEventListener('click', closeArchives);
  document.querySelector('#archives-maximize').addEventListener('click', () => {
    const maximized = windowEl.classList.toggle('is-maximized');
    if (maximized) {
      window.ZumaWindowManager?.resetPosition('archives');
      windowEl.style.width = '';
      windowEl.style.height = '';
    }
    document.querySelector('#archives-maximize').setAttribute('aria-label', `${maximized ? 'Restore' : 'Maximize'} archives window`);
  });
  document.querySelector('#archives-viewer-back').addEventListener('click', () => closeViewer());
  document.querySelector('#archives-prev').addEventListener('click', () => showMedia(currentIndex - 1));
  document.querySelector('#archives-next').addEventListener('click', () => showMedia(currentIndex + 1));
  layer.addEventListener('pointerdown', event => {
    if (event.target === layer) closeArchives();
  });
  document.addEventListener('keydown', event => {
    if (layer.hidden || !window.ZumaWindowManager?.isActive('archives')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (viewer.hidden) closeArchives();
      else closeViewer();
      return;
    }
    if (!viewer.hidden && !event.target.closest('video') && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      showMedia(currentIndex + (event.key === 'ArrowRight' ? 1 : -1));
      return;
    }
  });

  renderTree();
  renderContent();
})();
