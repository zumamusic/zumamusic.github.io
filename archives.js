import { installArchiveSwipe } from './archives-gestures.mjs';

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
  const content = document.querySelector('.archives-content');
  const viewer = document.querySelector('#archives-viewer');
  const explorer = document.querySelector('.archives-explorer');
  const viewerMedia = document.querySelector('#archives-viewer-media');
  const filmstrip = document.querySelector('#archives-filmstrip');
  let viewMode = 'dropdown';
  let currentFolder = 'root';
  const viewStates = {
    dropdown: { folder: 'root', expanded: false },
    folder: { folder: 'root', expanded: false }
  };
  let currentIndex = 0;
  let lastMediaButton = null;

  const rootName = () => viewMode === 'folder' ? 'LA_Archives' : 'Zuma_Archives';
  const activeCollection = () => collections.find(folder => folder.id === currentFolder);

  function setRootExpanded(expanded) {
    treeChildren.hidden = !expanded;
    rootToggle.textContent = expanded ? '−' : '+';
    rootToggle.setAttribute('aria-expanded', String(expanded));
    rootToggle.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${rootName().replace('_', ' ')}`);
  }

  function renderTree() {
    // Detach shared content before replacing either tree's markup.
    explorer.append(content);
    rootSelect.innerHTML = viewMode === 'folder'
      ? '<img src="dock-archives.png" alt="">'
      : '<span class="archives-folder-icon" aria-hidden="true"></span>';
    rootSelect.append(document.createTextNode(rootName()));
    treeChildren.replaceChildren();
    collections.forEach(folder => {
      if (viewMode === 'folder') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'archives-tree-folder archives-tree-child';
        button.dataset.folder = folder.id;
        button.innerHTML = '<img src="dock-archives.png" alt="">';
        button.append(document.createTextNode(folder.name));
        button.addEventListener('click', () => selectFolder(folder.id));
        treeChildren.append(button);
        return;
      }
      const branch = document.createElement('div');
      branch.className = 'archives-branch';
      branch.dataset.folder = folder.id;
      const row = document.createElement('div');
      row.className = 'archives-branch-row';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'archives-tree-toggle';
      toggle.addEventListener('click', () => selectFolder(viewMode === 'dropdown' && currentFolder === folder.id ? 'root' : folder.id));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'archives-tree-folder archives-tree-child';
      button.dataset.folder = folder.id;
      button.innerHTML = '<span class="archives-folder-icon" aria-hidden="true"></span>';
      button.append(document.createTextNode(folder.name));
      button.addEventListener('click', () => selectFolder(viewMode === 'dropdown' && currentFolder === folder.id ? 'root' : folder.id));
      row.append(toggle, button);
      branch.append(row);
      treeChildren.append(branch);
    });
    updateTreeSelection();
  }

  function updateTreeSelection() {
    windowEl.querySelectorAll('.archives-tree-folder').forEach(button => {
      const active = viewMode === 'folder' && button.dataset.folder === currentFolder;
      button.classList.toggle('is-selected', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    treeChildren.querySelectorAll('.archives-branch').forEach(branch => {
      const folder = collections.find(item => item.id === branch.dataset.folder);
      const expanded = folder.id === currentFolder;
      branch.classList.toggle('is-expanded', expanded);
      const toggle = branch.querySelector('.archives-tree-toggle');
      toggle.textContent = expanded ? '−' : '+';
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${folder.name}`);
      branch.querySelector('.archives-tree-folder').setAttribute('aria-expanded', String(expanded));
      if (expanded && viewMode === 'dropdown') branch.append(content);
    });
    if (viewMode === 'folder') explorer.append(content);
    content.hidden = viewMode === 'dropdown' && currentFolder === 'root';
  }

  function renderContent() {
    grid.replaceChildren();
    const folder = activeCollection();
    document.querySelector('#archives-current-folder').textContent = folder?.name ?? rootName();
    document.querySelector('#archives-address').textContent = folder ? `${rootName()} / ${folder.name}` : rootName();
    const count = folder ? folder.files.length : collections.length;
    document.querySelector('#archives-item-count').textContent = `${count} ${folder ? (count === 1 ? 'file' : 'files') : (count === 1 ? 'folder' : 'folders')}`;

    if (!folder) {
      collections.forEach(collection => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'archives-folder-card';
        button.innerHTML = '<img src="dock-archives.png" alt="">';
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
      image.draggable = false;
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

  // Follow the explorer's real bounds in both modes, including the address bar.
  function positionViewer() {
    if (layer.hidden) return;
    Object.assign(viewer.style, {
      top: `${explorer.offsetTop}px`, left: `${explorer.offsetLeft}px`,
      width: `${explorer.offsetWidth}px`, height: `${explorer.offsetHeight}px`,
      right: 'auto', bottom: 'auto'
    });
  }
  const viewerLayoutObserver = new ResizeObserver(positionViewer);
  viewerLayoutObserver.observe(explorer);
  viewerLayoutObserver.observe(windowEl);

  function openViewer(index) {
    resetSwipe();
    currentIndex = index;
    viewer.hidden = false;
    positionViewer();
    explorer.inert = true;
    renderViewer(activeCollection().files[index].type === 'video');
    document.querySelector('#archives-viewer-back').focus();
  }

  function closeViewer(restoreFocus = true) {
    if (viewer.hidden) return;
    resetSwipe();
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

  const resetSwipe = installArchiveSwipe(viewerMedia, direction => showMedia(currentIndex + direction), () => !viewer.hidden && !layer.hidden);

  function openArchives() {
    window.ZumaWindowManager?.open('archives');
    renderContent();
  }

  function closeArchives() {
    closeViewer(false);
    window.ZumaWindowManager?.close('archives');
    window.ZumaWindowManager?.restoreFocus(dockButton);
  }

  rootToggle.addEventListener('click', () => {
    const expanded = treeChildren.hidden;
    setRootExpanded(expanded);
    if (!expanded) selectFolder('root');
  });
  rootSelect.addEventListener('click', () => {
    if (viewMode === 'dropdown') setRootExpanded(true);
    selectFolder('root');
  });
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
  document.addEventListener('keydown', event => {
    if (layer.hidden || !window.ZumaWindowManager?.isActive('archives')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
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

  const menus = windowEl.querySelectorAll('.archives-menubar details');
  menus.forEach(menu => menu.addEventListener('toggle', () => {
    if (menu.open) menus.forEach(other => { if (other !== menu) other.open = false; });
  }));
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.archives-menubar')) menus.forEach(menu => { menu.open = false; });
  });
  windowEl.querySelectorAll('[data-archive-view]').forEach(button => button.addEventListener('click', () => {
    closeViewer(false);
    viewStates[viewMode] = { folder: currentFolder, expanded: !treeChildren.hidden };
    viewMode = button.dataset.archiveView;
    windowEl.dataset.view = viewMode;
    windowEl.querySelectorAll('[data-archive-view]').forEach(option => option.setAttribute('aria-pressed', String(option.dataset.archiveView === viewMode)));
    menus.forEach(menu => { menu.open = false; });
    currentFolder = viewStates[viewMode].folder;
    renderTree();
    setRootExpanded(viewStates[viewMode].expanded);
    selectFolder(currentFolder);
  }));
  windowEl.dataset.view = viewMode;
  renderTree();
  setRootExpanded(false);
  renderContent();
})();
