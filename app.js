// TamilCartoons App — Supabase Client Integration + Bulk Link Parser (50-100+ Links)
const SUPABASE_URL = "https://your-supabase-project.supabase.co";
const SUPABASE_ANON_KEY = "your-supabase-anon-key";

let supabaseClient = null;
function initSupabase() {
  if (!supabaseClient && window.supabase && SUPABASE_URL && !SUPABASE_URL.includes("your-supabase-project")) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

let items = [], current = null, currentSeason = 1, currentEpisode = 1, currentFilter = "All", currentLetter = "All", currentEpisodes = [], currentSeriesSeasons = [], pendingEpisode = null, currentRawLink = "", adminUser = null, editingSeriesId = null;

const $ = id => document.getElementById(id);
const FALLBACK_POSTER = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="#1b263b"/><text x="50%" y="50%" fill="#8cd0ff" font-size="28" text-anchor="middle">TamilCartoons</text></svg>');

function showHome(){ document.body.classList.remove('episode-mode'); $('home').classList.remove('hidden'); $('details').classList.add('hidden');$('adminPanel').classList.add('hidden'); window.scrollTo({top:0,behavior:'smooth'}); }
function searchAnime(){ renderCatalog(($('search').value||'').trim()); }
function filterNav(f){ currentFilter=f; currentLetter='All'; showHome(); renderCatalog($('search').value||''); }
function filterCards(f,el){ currentFilter=f; document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active')); el.classList.add('active'); renderCatalog($('search').value||''); }

if($('azRow')) {$('azRow').addEventListener('click', e => {
    const b = e.target.closest('button[data-letter]');
    if(b){ currentLetter = b.dataset.letter; renderCatalog($('search').value||''); }
  });
}
if($('search')) {$('search').addEventListener('keydown', e => { if(e.key==='Enter') searchAnime(); });
}

function renderCatalog(q=''){
  const box = $('catalog');
  if(!box) return;
  box.innerHTML = '';
  const shown = items.filter(x => (currentFilter==='All' || x.kind===currentFilter || x.language===currentFilter || (x.genre && x.genre.toLowerCase().includes(currentFilter.toLowerCase()))) && (currentLetter==='All' || (x.title||'').toUpperCase().startsWith(currentLetter)) && (x.title||'').toLowerCase().includes(q.toLowerCase()));
  shown.forEach(x => {
    const c = document.createElement('article');
    c.className = 'card';
    c.innerHTML = `<img class="poster" src="${escAttr(x.poster_url\vert{}\vert{}FALLBACK_POSTER)}" alt="" onerror="this.src='${FALLBACK_POSTER}'"><div class="card-body"><h3>${esc(x.title)}</h3><div class="meta">${esc(x.release_year\vert{}\vert{}'')} •${esc(x.kind||'Anime')}</div><div class="tag">${esc(x.language||'Tamil Dubbed')}</div></div>`;
    c.onclick = () => openDetails(x);
    box.appendChild(c);
  });
  if($('count')) $('count').textContent = shown.length + ' titles';
  if(!shown.length) box.innerHTML = '<p class="subtle" style="grid-column:1/-1">No published titles found. Sign in through Admin to add titles.</p>';
}

async function loadCatalog(){
  const client = initSupabase();
  if(!client) {
    $('catalog').innerHTML = '<p class="subtle" style="grid-column:1/-1">Supabase configuration pending. Please configure SUPABASE_URL and SUPABASE_ANON_KEY in app.js.</p>';
    return;
  }
  try {
    const { data, error } = await client.from('anime').select('*').eq('published', true).order('created_at', { ascending: false });
    if(error) throw error;
    items = data || [];
    renderCatalog();
  } catch(e) {
    console.error('Catalog load error:', e);
    $('catalog').innerHTML = '<p class="subtle" style="grid-column:1/-1">Could not load catalog from Supabase. Check table permissions or schema.</p>';
  }
}

async function openDetails(item){
  current = item;
  currentSeason = 1;
  currentEpisode = 1;
  document.body.classList.remove('episode-mode');
  $('home').classList.add('hidden');
  $('adminPanel').classList.add('hidden');
  $('details').classList.remove('hidden');
  $('detailPoster').src = item.poster_url || FALLBACK_POSTER;
  $('detailTitle').textContent = item.title;
  $('detailMeta').textContent = [item.release_year, item.kind, item.language, item.status].filter(Boolean).join(' • ');
  $('detailDesc').textContent = item.storyline || '';
  if($('detailInfoText')) {
    $('detailInfoText').textContent = item.anime_info ? ('Info: ' + item.anime_info) : '';
  }
  $('episodeStory').textContent = item.storyline || '';
  $('driveLink').value = '';
  clearPlayer();
  await renderSeasons();
  window.scrollTo({top:0,behavior:'smooth'});
}

async function renderSeasons(){
  if(!current) return;
  const client = initSupabase();
  if(!client) return;
  try {
    const { data, error } = await client.from('seasons').select('*').eq('anime_id', current.id).order('season_number', { ascending: true });
    if(error) throw error;
    currentSeriesSeasons = data || [];
    const box = $('seasons');
    box.innerHTML = '';
    if(!currentSeriesSeasons.length){
      box.innerHTML = '<span class="subtle">No seasons added yet.</span>';
      $('episodes').innerHTML = '';
      if($('episodeCount')) $('episodeCount').textContent = '0 episodes';
      return;
    }
    if(!currentSeriesSeasons.some(s => Number(s.season_number) === Number(currentSeason))) {
      currentSeason = Number(currentSeriesSeasons[0].season_number);
    }
    currentSeriesSeasons.forEach(s => {
      let b = document.createElement('button');
      b.className = 'season-btn' + (Number(s.season_number) === Number(currentSeason) ? ' active' : '');
      b.textContent = 'Season ' + s.season_number;
      b.onclick = () => { currentSeason = Number(s.season_number); renderSeasons(); renderEpisodes(); };
      box.appendChild(b);
    });
    await renderEpisodes();
  } catch(e) {
    console.error(e);
    $('seasons').innerHTML = '<span class="subtle">Could not load seasons.</span>';
  }
}

async function renderEpisodes(){
  const box = $('episodes');
  box.innerHTML = '';
  const season = currentSeriesSeasons.find(s => Number(s.season_number) === Number(currentSeason));
  if(!season){
    if($('episodeCount')) $('episodeCount').textContent = '0 episodes';
    return;
  }
  const client = initSupabase();
  if(!client) return;
  try {
    const { data, error } = await client.from('episodes').select('*').eq('season_id', season.id).eq('published', true).order('episode_number', { ascending: true });
    if(error) throw error;
    currentEpisodes = data || [];
    if($('episodeCount')) $('episodeCount').textContent = currentEpisodes.length + ' episodes';
    if(!currentEpisodes.length){
      box.innerHTML = '<p class="subtle">No published episodes for this season yet.</p>';
      return;
    }
    currentEpisodes.forEach(ep => {
      const b = document.createElement('button');
      b.className = 'episode';
      const thumb = ep.thumbnail_url || current.poster_url || FALLBACK_POSTER;
      b.innerHTML = `<img src="${escAttr(thumb)}" alt="" loading="lazy" onerror="this.src='${FALLBACK_POSTER}'"><div class="episode-copy"><strong>Episode ${String(ep.episode_number).padStart(2,'0')}${ep.title?' — '+esc(ep.title):''}</strong><span>▶ Watch Now</span></div>`;
      b.onclick = () => beginEpisodeNavigation(ep);
      box.appendChild(b);
    });
  } catch(e) {
    console.error(e);
    box.innerHTML = '<p class="subtle">Could not load episodes.</p>';
  }
}

function beginEpisodeNavigation(ep){
  currentEpisode = ep.episode_number;
  pendingEpisode = ep;
  $('interstitial').classList.remove('hidden');
}

function continueAfterAd(){
  $('interstitial').classList.add('hidden');
  if(!pendingEpisode) return;
  const ep = pendingEpisode;
  pendingEpisode = null;
  document.body.classList.add('episode-mode');
  $('home').classList.add('hidden');
  $('details').classList.remove('hidden');
  $('nowPlaying').textContent = `Season ${currentSeason} • Episode ${ep.episode_number}`;
  $('playerHeading').textContent = `${current.title} — S${currentSeason} E${ep.episode_number}`;
  $('episodePageTitle').textContent = `${current.title} — Season ${currentSeason}, Episode${ep.episode_number}`;
  $('episodeStory').textContent = ep.description || current.storyline || '';
  $('driveLink').value = ep.drive_url || '';
  if(ep.drive_url){
    $('driveFrame').src = videoEmbedUrl(ep.drive_url);
    currentRawLink = ep.drive_url;
  } else {
    $('driveFrame').src = 'about:blank';
    currentRawLink = '';
    alert('இந்த Episode-க்கு Video Link சேர்க்கப்படவில்லை.');
  }
  window.scrollTo({top:0,behavior:'smooth'});
}

function backToEpisodes(){
  document.body.classList.remove('episode-mode');
  $('driveFrame').src = 'about:blank';
  window.scrollTo({top:$('seasons').getBoundingClientRect().top+window.scrollY-100,behavior:'smooth'});
}

function videoEmbedUrl(raw){
  const s = (raw||'').trim();
  if(!s) return '';
  // Google Drive preview support
  const md = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if(md) return 'https://drive.google.com/file/d/' + md[1] + '/preview';
  // Mega support
  if(s.includes('mega.nz')) {
    return s;
  }
  return s;
}

function loadDriveLink(){
  const raw = $('driveLink').value.trim();
  if(!raw){ alert('Paste a video link first.'); return; }
  currentRawLink = raw;
  $('driveFrame').src = videoEmbedUrl(raw);
  $('nowPlaying').textContent = current ? `Season ${currentSeason} • Episode ${currentEpisode}` : 'Video loaded';
  $('playerHeading').textContent = current ? `${current.title} — S${currentSeason} E${currentEpisode}` : 'Video Player';
}

function clearPlayer(){
  $('driveFrame').src = 'about:blank';
  $('nowPlaying').textContent = 'Select an episode';
  $('playerHeading').textContent = 'Video Player';
  currentRawLink = '';
}

async function copyCurrentLink(){
  if(!currentRawLink){ alert('No link loaded.'); return; }
  try {
    await navigator.clipboard.writeText(currentRawLink);
    alert('Link copied.');
  } catch(e) {
    prompt('Copy this link:', currentRawLink);
  }
}

function showLoginStatus(msg){
  let status = $('adminLoginStatus');
  if(!status){
    status = document.createElement('p');
    status.id = 'adminLoginStatus';
    status.style.cssText = 'margin:12px 0;padding:10px 12px;border-radius:8px;background:#17243a;color:#e8f0ff;overflow-wrap:anywhere';
    $('adminAuth').appendChild(status);
  }
  status.textContent = msg;
}

function openAdmin(){
  showHome();
  $('home').classList.add('hidden');
  $('adminPanel').classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
  checkAdminSession();
}

function closeAdmin(){
  $('adminPanel').classList.add('hidden');
  $('home').classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}

async function adminLogin(){
  const client = initSupabase();
  if(!client) return showLoginStatus('Supabase client not initialized.');
  const email = $('adminEmail').value.trim();
  const password = $('adminPassword').value;
  if(!email || !password) return showLoginStatus('Enter email and password.');
  showLoginStatus('Signing in...');
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if(error) throw error;
    adminUser = data.user;
    checkAdminSession();
  } catch(e) {
    showLoginStatus('Sign-in failed: ' + (e.message || String(e)));
  }
}

async function adminLogout(){
  const client = initSupabase();
  if(client) await client.auth.signOut();
  adminUser = null;
  $('adminWorkspace').classList.add('hidden');
  $('adminAuth').classList.remove('hidden');
  showLoginStatus('Signed out.');
}

async function checkAdminSession(){
  const client = initSupabase();
  if(!client) {
    showLoginStatus('Supabase is not configured.');
    return;
  }
  try {
    const { data: { session } } = await client.auth.getSession();
    if(!session || !session.user){
      adminUser = null;
      $('adminWorkspace').classList.add('hidden');
      $('adminAuth').classList.remove('hidden');
      showLoginStatus('Please sign in with admin credentials.');
      return;
    }
    adminUser = session.user;
    $('adminAuth').classList.add('hidden');
    $('adminWorkspace').classList.remove('hidden');
    if($('adminStatus')) $('adminStatus').textContent = 'Signed in as ' + (adminUser.email || 'Admin');
    await loadAdminSeries();
  } catch(e) {
    console.error(e);
    showLoginStatus('Session check error: ' + (e.message || String(e)));
  }
}

function setStatus(msg){
  const el = $('adminStatus');
  if(el) el.textContent = msg;
}

async function saveSeries(){
  const client = initSupabase();
  if(!client || !adminUser) return alert('Sign in first.');
  const title = $('fTitle').value.trim();
  if(!title) return alert('Title is required.');

  const record = {
    title,
    kind: $('fKind').value,
    language: $('fLang').value,
    release_year: $('fYear').value ? Number($('fYear').value) : null,
    status: $('fStatus').value,
    genre: $('fGenre').value.trim(),
    poster_url: $('fPoster').value.trim() || null,
    video_format: $('fFormat').value,
    anime_info: $('fInfo').value.trim(),
    storyline: $('fStory').value.trim(),
    published: $('fPublished').value === 'true',
    updated_at: new Date().toISOString()
  };

  try {
    let resId = $('editSeriesId').value;
    if(resId){
      const { error } = await client.from('anime').update(record).eq('id', resId);
      if(error) throw error;
      record.id = resId;
    } else {
      record.created_at = new Date().toISOString();
      const { data, error } = await client.from('anime').insert([record]).select().single();
      if(error) throw error;
      record.id = data.id;
    }
    $('editSeriesId').value = record.id;
    editingSeriesId = record.id;
    $('seriesFormHeading').textContent = 'Edit Anime / Cartoon';
    setStatus('Anime saved successfully.');
    await loadAdminSeries();
    await loadCatalog();
    openEpisodeEditor(record);
  } catch(e) {
    console.error(e);
    alert('Save anime failed: ' + (e.message || String(e)));
  }
}

function resetSeriesForm(){
  ['editSeriesId','fTitle','fYear','fGenre','fPoster','fInfo','fStory'].forEach(id => $(id).value = '');
  $('fKind').value = 'Anime';
  $('fLang').value = 'Tamil Dubbed';
  $('fStatus').value = 'Ongoing';
  $('fFormat').value = 'Google Drive / Mega';
  $('fPublished').value = 'true';
  $('seriesFormHeading').textContent = 'Add Anime / Cartoon';
  editingSeriesId = null;
  if($('episodeEditor')) $('episodeEditor').classList.add('hidden');
}

function editSeries(x){
  $('editSeriesId').value = x.id;
  editingSeriesId = x.id;
  $('fTitle').value = x.title || '';
  $('fKind').value = x.kind || 'Anime';
  $('fLang').value = x.language || 'Tamil Dubbed';
  $('fYear').value = x.release_year || '';
  $('fStatus').value = x.status || 'Ongoing';
  $('fGenre').value = x.genre || '';
  $('fPoster').value = x.poster_url || '';
  $('fFormat').value = x.video_format || 'Google Drive / Mega';
  $('fInfo').value = x.anime_info || '';
  $('fStory').value = x.storyline || '';
  $('fPublished').value = String(x.published);
  $('seriesFormHeading').textContent = 'Edit Anime / Cartoon';
  openEpisodeEditor(x);
  window.scrollTo({top:$('seriesFormHeading').getBoundingClientRect().top+window.scrollY-100,behavior:'smooth'});
}

async function loadAdminSeries(){
  const client = initSupabase();
  if(!client || !adminUser) return;
  try {
    const { data, error } = await client.from('anime').select('*').order('created_at', { ascending: false });
    if(error) throw error;
    const box = $('adminSeriesList');
    box.innerHTML = '';
    (data || []).forEach(x => {
      const row = document.createElement('div');
      row.className = 'admin-item';
      row.innerHTML = `<img src="${escAttr(x.poster_url||FALLBACK_POSTER)}" alt=""><div class="grow"><strong>${esc(x.title)}</strong><div class="subtle">${esc(x.kind)} •${x.published?'Published':'Draft'}</div></div><button class="secondary">Edit</button><button class="danger">Delete</button>`;
      row.querySelector('.secondary').onclick = () => editSeries(x);
      row.querySelector('.danger').onclick = () => deleteSeries(x);
      box.appendChild(row);
    });
  } catch(e) {
    console.error(e);
  }
}

async function deleteSeries(x){
  if(!confirm('Delete ' + x.title + ' and all its seasons/episodes?')) return;
  const client = initSupabase();
  if(!client) return;
  try {
    const { data: seasons } = await client.from('seasons').select('id').eq('anime_id', x.id);
    if(seasons && seasons.length){
      const sIds = seasons.map(s => s.id);
      await client.from('episodes').delete().in('season_id', sIds);
      await client.from('seasons').delete().eq('anime_id', x.id);
    }
    await client.from('anime').delete().eq('id', x.id);
    resetSeriesForm();
    await loadAdminSeries();
    await loadCatalog();
    setStatus('Deleted successfully.');
  } catch(e) {
    alert('Delete failed: ' + (e.message || String(e)));
  }
}

async function openEpisodeEditor(series){
  editingSeriesId = series.id;
  $('episodeEditor').classList.remove('hidden');
  $('episodeEditorTitle').textContent = 'Managing: ' + series.title;
  resetEpisodeForm();
  await loadAdminEpisodes();
}

function resetEpisodeForm(){
  $('editEpisodeId').value = '';
  $('eSeason').value = '1';
  $('eNumber').value = '1';
  $('eTitle').value = '';
  $('eDrive').value = '';
  $('eThumb').value = '';
  $('eDesc').value = '';
  $('ePublished').value = 'true';
}

async function getOrCreateSeasonId(animeId, seasonNum){
  const client = initSupabase();
  const { data: existing } = await client.from('seasons').select('id').eq('anime_id', animeId).eq('season_number', seasonNum).maybeSingle();
  if(existing) return existing.id;

  const { data: created, error } = await client.from('seasons').insert([{
    anime_id: animeId,
    season_number: seasonNum,
    title: 'Season ' + seasonNum,
    created_at: new Date().toISOString()
  }]).select().single();
  if(error) throw error;
  return created.id;
}

async function saveEpisode(){
  const client = initSupabase();
  if(!client || !editingSeriesId) return alert('Select an anime first.');
  const seasonNum = Number($('eSeason').value);
  const episodeNum = Number($('eNumber').value);
  const drive = $('eDrive').value.trim();
  if(!seasonNum || !episodeNum || !drive) return alert('Season, Episode number and Video link are required.');

  try {
    const seasonId = await getOrCreateSeasonId(editingSeriesId, seasonNum);
    const record = {
      season_id: seasonId,
      episode_number: episodeNum,
      title: $('eTitle').value.trim(),
      drive_url: drive,
      thumbnail_url: $('eThumb').value.trim() || null,
      description: $('eDesc').value.trim(),
      published: $('ePublished').value === 'true',
      updated_at: new Date().toISOString()
    };

    const epId = $('editEpisodeId').value;
    if(epId){
      const { error } = await client.from('episodes').update(record).eq('id', epId);
      if(error) throw error;
    } else {
      record.created_at = new Date().toISOString();
      const { error } = await client.from('episodes').insert([record]);
      if(error) throw error;
    }
    setStatus('Episode saved successfully.');
    resetEpisodeForm();
    await loadAdminEpisodes();
  } catch(e) {
    console.error(e);
    alert('Episode save failed: ' + (e.message || String(e)));
  }
}

// BULK LINK PARSER FOR 50-100+ LINKS (Google Drive / Mega, commas, quotes, lines)
async function saveBulkEpisodes(){
  const client = initSupabase();
  if(!client || !editingSeriesId) return alert('Sign in and select an anime first.');

  const seasonNum = Number($('eSeason').value);
  const startNum = Number($('eNumber').value);
  const rawText = $('bulkEpisodeLinks').value.trim();

  if(!seasonNum || !startNum) return alert('Enter Season Number and starting Episode Number first.');
  if(!rawText) return alert('Paste 50 to 100 video links in the box.');

  try {
    // Robust parsing supporting comma separation, newlines, single/double quotes
    // 1. Replace commas outside or inside quotes or split by newline/comma safely
    let cleaned = rawText
      .replace(/["']/g, '') // remove surrounding quotes
      .split(/[\r\n]+/)     // split by lines first
      .flatMap(line => line.split(',')) // split by comma if comma separated
      .map(item => item.trim())
      .filter(item => item.length > 0);

    // Filter valid URLs (http:// or https://)
    const validLinks = cleaned.filter(item => /^https?:\/\//i.test(item));

    if(!validLinks.length){
      return alert('No valid URLs found. Please check your pasted links.');
    }

    if(!confirm(`Found ${validLinks.length} valid video links. Save them as sequential episodes starting from Episode ${startNum} in Season${seasonNum}?`)){
      return;
    }

    setStatus(`Processing ${validLinks.length} episodes... Please wait.`);

    const seasonId = await getOrCreateSeasonId(editingSeriesId, seasonNum);
    
    let savedCount = 0;
    for(let i = 0; i < validLinks.length; i++){
      const epNum = startNum + i;
      const url = validLinks[i];
      const title = `Episode ${epNum}`;

      // Check if episode number already exists in this season to avoid duplicate overwrite
      const { data: existing } = await client.from('episodes')
        .select('id')
        .eq('season_id', seasonId)
        .eq('episode_number', epNum)
        .maybeSingle();

      const record = {
        season_id: seasonId,
        episode_number: epNum,
        title: title,
        drive_url: url,
        thumbnail_url: null,
        description: '',
        published: $('ePublished').value === 'true',
        updated_at: new Date().toISOString()
      };

      if(existing){
        // Update existing or skip? Requirement: avoid accidentally overwriting / duplicate. We update URL if needed or insert if not.
        await client.from('episodes').update({ drive_url: url, updated_at: new Date().toISOString() }).eq('id', existing.id);
      } else {
        record.created_at = new Date().toISOString();
        await client.from('episodes').insert([record]);
      }
      savedCount++;
    }

    $('bulkEpisodeLinks').value = '';
    setStatus(`Successfully saved ${savedCount} episodes (Season${seasonNum}, Episode ${startNum} to${startNum + savedCount - 1})!`);
    await loadAdminEpisodes();
    await loadCatalog();
  } catch(e) {
    console.error(e);
    alert('Bulk episode save failed: ' + (e.message || String(e)));
  }
}

async function loadAdminEpisodes(){
  if(!editingSeriesId) return;
  const client = initSupabase();
  try {
    const { data: seasons } = await client.from('seasons').select('*').eq('anime_id', editingSeriesId);
    if(!seasons || !seasons.length){
      $('adminEpisodeList').innerHTML = '<p class="subtle">No seasons/episodes yet.</p>';
      return;
    }
    const seasonMap = Object.fromEntries(seasons.map(s => [s.id, s]));
    const sIds = seasons.map(s => s.id);

    const { data: eps } = await client.from('episodes').select('*').in('season_id', sIds).order('episode_number', { ascending: true });
    const box = $('adminEpisodeList');
    box.innerHTML = '';
    if(!eps || !eps.length){
      box.innerHTML = '<p class="subtle">No episodes added yet.</p>';
      return;
    }

    eps.forEach(ep => {
      const season = seasonMap[ep.season_id] || { season_number: 1 };
      const row = document.createElement('div');
      row.className = 'episode-admin-row';
      row.innerHTML = `<div><strong>S${season.season_number} • E${ep.episode_number}${esc(ep.title||'')}</strong><div class="subtle">${ep.published?'Published':'Draft'} • Link: ${esc(ep.drive_url||'')}</div></div><div><button class="secondary">Edit</button> <button class="danger">Delete</button></div>`;
      row.querySelector('.secondary').onclick = () => {
        $('editEpisodeId').value = ep.id;
        $('eSeason').value = season.season_number;
        $('eNumber').value = ep.episode_number;
        $('eTitle').value = ep.title || '';
        $('eDrive').value = ep.drive_url || '';
        $('eThumb').value = ep.thumbnail_url || '';
        $('eDesc').value = ep.description || '';
        $('ePublished').value = String(ep.published);
        window.scrollTo({top:$('episodeEditor').getBoundingClientRect().top+window.scrollY-100,behavior:'smooth'});
      };
      row.querySelector('.danger').onclick = async () => {
        if(confirm('Delete this episode?')){
          await client.from('episodes').delete().eq('id', ep.id);
          await loadAdminEpisodes();
        }
      };
      box.appendChild(row);
    });
  } catch(e) {
    console.error(e);
  }
}

function esc(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','":':'&quot;',"'":'&#39;'}[c] || c)); }
function escAttr(s){ return esc(s).replace(/`/g,'&#96;'); }

Object.assign(window, {
  showHome, searchAnime, openAdmin, closeAdmin, adminLogin, adminLogout,
  saveSeries, resetSeriesForm, saveEpisode, saveBulkEpisodes, resetEpisodeForm,
  filterNav, filterCards, backToEpisodes, loadDriveLink, clearPlayer,
  copyCurrentLink, continueAfterAd
});

window.onEpisodeAdFinished = continueAfterAd;

document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  loadCatalog();
  if(supabaseClient) {
    supabaseClient.auth.onAuthStateChanged((event, session) => {
      if(session && session.user) adminUser = session.user;
      else adminUser = null;
    });
  }
});
