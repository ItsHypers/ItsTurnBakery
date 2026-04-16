import { useEffect, useState } from 'react';

const ADMIN_WORKER_URL = 'https://admin-panel.ryanathomas013.workers.dev';
const ADMIN_CREDENTIALS_KEY = 'bakery-admin-credentials';
const ADMIN_PANEL_STORAGE_KEY = 'bakery-admin-panel';
const ADMIN_PANEL_TABS = [
  {
    id: 'admin-orders',
    field: 'orders',
    label: 'Orders',
    placeholder: 'Customer orders, pickup times, paid status, and special requests.',
  },
  {
    id: 'admin-recipes',
    field: 'recipes',
    label: 'Potential Recipes',
    placeholder: 'Ideas to test, ingredient notes, costing, and seasonal specials.',
  },
  {
    id: 'admin-notes',
    field: 'notes',
    label: 'Note Board',
    placeholder: "Reminders for the team, supplier notes, prep lists, and tomorrow's priorities.",
  },
];
const EMPTY_ADMIN_PANEL = {
  orders: '',
  recipes: '',
  notes: '',
};
const DEFAULT_ADMIN_PANEL_TAB_ID = ADMIN_PANEL_TABS[0].id;
const EMPTY_MENU = {
  businessName: '',
  orderPhone: '',
  categories: [],
};

function getSessionValue(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSessionValue(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // The login still works for the current render; saving may ask again if storage is blocked.
  }
}

function removeSessionValue(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nothing to clear when browser storage is unavailable.
  }
}

function getStoredAdminPanel() {
  try {
    return {
      ...EMPTY_ADMIN_PANEL,
      ...JSON.parse(localStorage.getItem(ADMIN_PANEL_STORAGE_KEY) || '{}'),
    };
  } catch {
    return EMPTY_ADMIN_PANEL;
  }
}

function setStoredAdminPanel(panel) {
  try {
    localStorage.setItem(ADMIN_PANEL_STORAGE_KEY, JSON.stringify(panel));
  } catch {
    // Keep the notes editable in memory if local storage is unavailable.
  }
}

function isAdminPath() {
  return window.location.pathname.replace(/\/+$/, '').endsWith('/admin');
}

function getAppHomePath() {
  const pathname = window.location.pathname.replace(/\/+$/, '');

  if (pathname.endsWith('/admin')) {
    return `${pathname.slice(0, -'/admin'.length) || '/'}/`;
  }

  return './';
}

function createId(value) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `${slug || 'item'}-${Date.now().toString(36)}`;
}

function normalizeMenu(menu) {
  return {
    ...EMPTY_MENU,
    ...menu,
    categories: (menu.categories ?? []).map((category) => ({
      published: true,
      ...category,
      items: category.items ?? [],
    })),
  };
}

function isAdminPanelTab(tabId) {
  return ADMIN_PANEL_TABS.some((tab) => tab.id === tabId);
}

function App() {
  const [menu, setMenu] = useState(EMPTY_MENU);
  const [adminPanel, setAdminPanel] = useState(getStoredAdminPanel);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [activeTabId, setActiveTabId] = useState(() => (isAdminPath() ? 'admin' : 'order-now'));
  const [isAdminRoute, setIsAdminRoute] = useState(isAdminPath);
  const [adminSession, setAdminSession] = useState(
    () => Boolean(getSessionValue(ADMIN_CREDENTIALS_KEY)),
  );
  const [adminForm, setAdminForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSavingMenu, setIsSavingMenu] = useState(false);
  const [menuStatus, setMenuStatus] = useState('');
  const [selectedAdminCategoryId, setSelectedAdminCategoryId] = useState(
    DEFAULT_ADMIN_PANEL_TAB_ID,
  );

  useEffect(() => {
    async function loadMenu() {
      setIsLoadingMenu(true);

      try {
        const response = await fetch(`${ADMIN_WORKER_URL}/menu`);
        const result = await response.json();

        if (!response.ok || !result.ok || !result.menu) {
          throw new Error(result.error || 'Unable to load the menu');
        }

        setMenu(normalizeMenu(result.menu));
        setMenuStatus('');
      } catch (error) {
        setMenuStatus(error.message || 'Unable to load the menu from Cloudflare.');
      } finally {
        setIsLoadingMenu(false);
      }
    }

    loadMenu();
  }, []);

  useEffect(() => {
    function syncRoute() {
      setIsAdminRoute(isAdminPath());
    }

    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  useEffect(() => {
    if (isAdminPanelTab(selectedAdminCategoryId)) {
      return;
    }

    if (!menu.categories.some((category) => category.id === selectedAdminCategoryId)) {
      setSelectedAdminCategoryId(DEFAULT_ADMIN_PANEL_TAB_ID);
    }
  }, [menu.categories, selectedAdminCategoryId]);

  useEffect(() => {
    if (isAdminRoute) {
      setActiveTabId('admin');
    } else if (activeTabId === 'admin') {
      setActiveTabId(
        menu.categories.find((category) => category.published !== false)?.id ?? 'order-now',
      );
    }
  }, [activeTabId, isAdminRoute, menu.categories]);

  useEffect(() => {
    if (isAdminRoute) {
      return;
    }

    const validTabIds = [
      ...menu.categories
        .filter((category) => category.published !== false)
        .map((category) => category.id),
      'order-now',
      'admin',
    ];

    if (!validTabIds.includes(activeTabId)) {
      setActiveTabId(
        menu.categories.find((category) => category.published !== false)?.id ?? 'order-now',
      );
    }
  }, [activeTabId, isAdminRoute, menu.categories]);

  const customerTabs = [
    ...menu.categories.filter((category) => category.published !== false),
    {
      id: 'order-now',
      label: 'Order Now',
    },
  ];
  const activeCategory = menu.categories.find((category) => category.id === activeTabId);
  const isOrderTab = activeTabId === 'order-now';
  const isAdminTab = activeTabId === 'admin';
  const selectedAdminCategory = menu.categories.find(
    (category) => category.id === selectedAdminCategoryId,
  );

  function showCustomerTab(tabId) {
    if (isAdminPath()) {
      window.history.pushState({}, '', getAppHomePath());
      setIsAdminRoute(false);
    }

    setActiveTabId(tabId);
  }

  async function handleAdminLogin(event) {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const response = await fetch(`${ADMIN_WORKER_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adminForm),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Invalid username or password');
      }

      setSessionValue(
        ADMIN_CREDENTIALS_KEY,
        btoa(`${adminForm.username}:${adminForm.password}`),
      );
      setAdminSession(true);
      setAdminForm({ username: '', password: '' });
      setMenuStatus('Signed in. Menu changes can now be saved.');
    } catch (error) {
      setLoginError(
        error instanceof TypeError
          ? 'Unable to reach the admin login. Check that the Worker allows requests from this website.'
          : error.message,
      );
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleAdminLogout() {
    removeSessionValue(ADMIN_CREDENTIALS_KEY);
    setAdminSession(false);
    setMenuStatus('');
  }

  function updateMenuDraft(updater) {
    setMenu((currentMenu) => {
      const nextMenu = updater(currentMenu);
      return nextMenu;
    });
    setMenuStatus('Unsaved changes.');
  }

  async function saveMenu(nextMenu = menu) {
    const credentials = getSessionValue(ADMIN_CREDENTIALS_KEY);

    if (!credentials) {
      setMenuStatus('Sign in before saving menu changes.');
      return;
    }

    setIsSavingMenu(true);
    setMenuStatus('Saving menu...');

    try {
      const response = await fetch(`${ADMIN_WORKER_URL}/admin/menu`, {
        method: 'PUT',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ menu: nextMenu }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Unable to save the menu');
      }

      setMenu(normalizeMenu(result.menu));
      setMenuStatus('Menu saved to Cloudflare.');
    } catch (error) {
      setMenuStatus(error.message);
    } finally {
      setIsSavingMenu(false);
    }
  }

  function updateCategory(categoryId, field, value) {
    updateMenuDraft((currentMenu) => ({
      ...currentMenu,
      categories: currentMenu.categories.map((category) =>
        category.id === categoryId ? { ...category, [field]: value } : category,
      ),
    }));
  }

  function addCategory() {
    const category = {
      id: createId('new-tab'),
      label: 'New Tab',
      published: false,
      items: [],
    };

    updateMenuDraft((currentMenu) => ({
      ...currentMenu,
      categories: [...currentMenu.categories, category],
    }));
    setSelectedAdminCategoryId(category.id);
  }

  function updateAdminPanel(field, value) {
    setAdminPanel((currentPanel) => {
      const nextPanel = {
        ...currentPanel,
        [field]: value,
      };

      setStoredAdminPanel(nextPanel);
      return nextPanel;
    });
  }

  function removeCategory(categoryId) {
    updateMenuDraft((currentMenu) => {
      const categories = currentMenu.categories.filter((category) => category.id !== categoryId);
      const nextActiveTabId = categories[0]?.id ?? 'order-now';

      if (activeTabId === categoryId) {
        setActiveTabId(nextActiveTabId);
      }

      return {
        ...currentMenu,
        categories,
      };
    });
  }

  function addItem(categoryId) {
    const item = {
      id: createId('new-bake'),
      title: 'New Bake',
      description: 'Add a short description for this menu item.',
      price: '$0.00',
      photo: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80',
      photoAlt: 'Fresh baked goods on a bakery table',
    };

    updateMenuDraft((currentMenu) => ({
      ...currentMenu,
      categories: currentMenu.categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              items: [...category.items, item],
            }
          : category,
      ),
    }));
  }

  function updateItem(categoryId, itemId, field, value) {
    updateMenuDraft((currentMenu) => ({
      ...currentMenu,
      categories: currentMenu.categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              items: category.items.map((item) =>
                item.id === itemId ? { ...item, [field]: value } : item,
              ),
            }
          : category,
      ),
    }));
  }

  function removeItem(categoryId, itemId) {
    updateMenuDraft((currentMenu) => ({
      ...currentMenu,
      categories: currentMenu.categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              items: category.items.filter((item) => item.id !== itemId),
            }
          : category,
      ),
    }));
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label={`${menu.businessName || 'Bakery'} home`}>
          {menu.businessName || 'Bakery'}
        </a>
        <nav aria-label="Menu categories">
          {customerTabs.map((tab) => (
            <a
              className={`nav-link ${activeTabId === tab.id ? 'is-active' : ''}`}
              href="#menu"
              key={tab.id}
              onClick={(event) => {
                event.preventDefault();
                showCustomerTab(tab.id);
                document.getElementById('menu')?.scrollIntoView();
              }}
            >
              {tab.label}
            </a>
          ))}
        </nav>
      </header>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Small batch bakery</p>
          <h1 id="hero-title">Fresh bakes for slow mornings and bright tables.</h1>
          <p>
            Golden biscuits, tender crumb, and seasonal finishes baked in careful batches every
            morning.
          </p>
          <a className="hero-action" href="#menu">
            Browse the menu
          </a>
        </div>
      </section>

      <section className="menu-section" id="menu" aria-labelledby="menu-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Menu</p>
            <h2 id="menu-title">
              {isAdminTab ? 'Admin Menu' : isOrderTab ? 'Order Now' : activeCategory?.label}
            </h2>
          </div>
          <p>
            {isAdminTab
              ? 'Sign in to manage menu tabs and bakery items.'
              : isOrderTab
                ? 'Fresh bakes are made in small batches. A quick text is the easiest way to reserve yours.'
                : 'Choose a single warm bake, build a box, or save a few for the walk home.'}
          </p>
        </div>

        <div className="tabs" role="tablist" aria-label="Bakery menu">
          {customerTabs.map((tab) => (
            <button
              className={`tab ${activeTabId === tab.id ? 'is-active' : ''}`}
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTabId === tab.id}
              onClick={() => showCustomerTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="tab-content" key={activeTabId}>
          {isLoadingMenu && !isAdminTab ? (
            <div className="order-panel">
              <p className="eyebrow">Loading</p>
              <h3>Getting today&apos;s menu</h3>
              <p>Fresh bakes are coming from Cloudflare.</p>
            </div>
          ) : isAdminTab ? (
            <AdminPanel
              adminForm={adminForm}
              adminSession={adminSession}
              isLoggingIn={isLoggingIn}
              loginError={loginError}
              adminPanel={adminPanel}
              isSavingMenu={isSavingMenu}
              menu={menu}
              menuStatus={menuStatus}
              selectedAdminCategory={selectedAdminCategory}
              selectedAdminCategoryId={selectedAdminCategoryId}
              onAddCategory={addCategory}
              onAddItem={addItem}
              onAdminFormChange={setAdminForm}
              onLogin={handleAdminLogin}
              onLogout={handleAdminLogout}
              onRemoveCategory={removeCategory}
              onRemoveItem={removeItem}
              onSaveMenu={saveMenu}
              onSelectCategory={setSelectedAdminCategoryId}
              onUpdateAdminPanel={updateAdminPanel}
              onUpdateCategory={updateCategory}
              onUpdateItem={updateItem}
            />
          ) : isOrderTab ? (
            <div className="order-panel">
              <p className="eyebrow">Text to order</p>
              <h3>
                {menu.orderPhone
                  ? `Send your order to ${menu.orderPhone}`
                  : 'Ordering details are coming soon'}
              </h3>
              <p>
                Include your name, pickup day, pickup time, and the bakes you would like. We will
                text back to confirm availability.
              </p>
              {menu.orderPhone ? (
                <a
                  className="hero-action"
                  href={`sms:${menu.orderPhone.replaceAll(/[^+\d]/g, '')}`}
                >
                  Text {menu.orderPhone}
                </a>
              ) : null}
            </div>
          ) : (
            <div className="menu-grid">
              {activeCategory?.items.map((item) => (
                <article className="menu-card" key={item.id}>
                  <img src={item.photo} alt={item.photoAlt} />
                  <div className="menu-card-content">
                    <div className="item-title-row">
                      <h3>{item.title}</h3>
                      <span>{item.price}</span>
                    </div>
                    <p>{item.description}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer>
        <span>{menu.businessName || 'Bakery'}</span>
        <span>Open daily from 7:00 AM</span>
      </footer>
    </main>
  );
}

function AdminPanel({
  adminForm,
  adminPanel,
  adminSession,
  isLoggingIn,
  isSavingMenu,
  loginError,
  menu,
  menuStatus,
  selectedAdminCategory,
  selectedAdminCategoryId,
  onAddCategory,
  onAddItem,
  onAdminFormChange,
  onLogin,
  onLogout,
  onRemoveCategory,
  onRemoveItem,
  onSaveMenu,
  onSelectCategory,
  onUpdateAdminPanel,
  onUpdateCategory,
  onUpdateItem,
}) {
  if (!adminSession) {
    return (
      <form className="admin-login" onSubmit={onLogin}>
        <p className="eyebrow">Owner login</p>
        <h3>Manage the bakery menu</h3>
        <label>
          Username
          <input
            autoComplete="username"
            value={adminForm.username}
            onChange={(event) =>
              onAdminFormChange({ ...adminForm, username: event.target.value })
            }
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            type="password"
            value={adminForm.password}
            onChange={(event) =>
              onAdminFormChange({ ...adminForm, password: event.target.value })
            }
          />
        </label>
        {loginError ? <p className="form-error">{loginError}</p> : null}
        <button className="hero-action" disabled={isLoggingIn} type="submit">
          {isLoggingIn ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Signed in</p>
          <h3>Menu editor</h3>
        </div>
        <div className="admin-actions">
          <button
            className="hero-action"
            disabled={isSavingMenu}
            type="button"
            onClick={() => onSaveMenu()}
          >
            {isSavingMenu ? 'Saving...' : 'Save menu'}
          </button>
          <button className="secondary-action" type="button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </div>
      {menuStatus ? <p className="admin-status">{menuStatus}</p> : null}

      <div className="admin-layout">
        <aside className="admin-sidebar" aria-label="Admin menu tabs">
          {ADMIN_PANEL_TABS.map((tab) => (
            <button
              className={`admin-tab ${selectedAdminCategoryId === tab.id ? 'is-active' : ''}`}
              key={tab.id}
              type="button"
              onClick={() => onSelectCategory(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <button className="secondary-action" type="button" onClick={onAddCategory}>
            Add new tab
          </button>
          {menu.categories.map((category) => (
            <button
              className={`admin-tab ${selectedAdminCategoryId === category.id ? 'is-active' : ''}`}
              key={category.id}
              type="button"
              onClick={() => onSelectCategory(category.id)}
            >
              <span>{category.label}</span>
              {category.published === false ? <span className="admin-tab-status">Draft</span> : null}
            </button>
          ))}
        </aside>

        {isAdminPanelTab(selectedAdminCategoryId) ? (
          <div className="admin-editor">
            <AdminPanelNoteTab
              adminPanel={adminPanel}
              selectedAdminCategoryId={selectedAdminCategoryId}
              onUpdateAdminPanel={onUpdateAdminPanel}
            />
          </div>
        ) : selectedAdminCategory ? (
          <div className="admin-editor">
            <div className="admin-field-row category-settings">
              <label>
                Tab name
                <input
                  value={selectedAdminCategory.label}
                  onChange={(event) =>
                    onUpdateCategory(selectedAdminCategory.id, 'label', event.target.value)
                  }
                />
              </label>
              <label className="checkbox-field">
                <input
                  checked={selectedAdminCategory.published !== false}
                  type="checkbox"
                  onChange={(event) =>
                    onUpdateCategory(selectedAdminCategory.id, 'published', event.target.checked)
                  }
                />
                Published on website
              </label>
              <button
                className="danger-action"
                type="button"
                onClick={() => onRemoveCategory(selectedAdminCategory.id)}
              >
                Remove tab
              </button>
            </div>

            <div className="admin-toolbar">
              <h3>Items</h3>
              <button
                className="secondary-action"
                type="button"
                onClick={() => onAddItem(selectedAdminCategory.id)}
              >
                Add item
              </button>
            </div>

            <div className="admin-items">
              {selectedAdminCategory.items.map((item) => (
                <article className="admin-item" key={item.id}>
                  <div className="admin-field-row">
                    <label>
                      Item name
                      <input
                        value={item.title}
                        onChange={(event) =>
                          onUpdateItem(
                            selectedAdminCategory.id,
                            item.id,
                            'title',
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label>
                      Price
                      <input
                        value={item.price}
                        onChange={(event) =>
                          onUpdateItem(
                            selectedAdminCategory.id,
                            item.id,
                            'price',
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Description
                    <textarea
                      value={item.description}
                      onChange={(event) =>
                        onUpdateItem(
                          selectedAdminCategory.id,
                          item.id,
                          'description',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label>
                    Photo URL
                    <input
                      value={item.photo}
                      onChange={(event) =>
                        onUpdateItem(
                          selectedAdminCategory.id,
                          item.id,
                          'photo',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label>
                    Photo alt text
                    <input
                      value={item.photoAlt}
                      onChange={(event) =>
                        onUpdateItem(
                          selectedAdminCategory.id,
                          item.id,
                          'photoAlt',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <button
                    className="danger-action"
                    type="button"
                    onClick={() => onRemoveItem(selectedAdminCategory.id, item.id)}
                  >
                    Remove item
                  </button>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="order-panel">
            <p>Add a tab to start building the menu.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminPanelNoteTab({ adminPanel, selectedAdminCategoryId, onUpdateAdminPanel }) {
  const selectedTab =
    ADMIN_PANEL_TABS.find((tab) => tab.id === selectedAdminCategoryId) ?? ADMIN_PANEL_TABS[0];

  return (
    <label className="admin-note-tab">
      {selectedTab.label}
      <textarea
        placeholder={selectedTab.placeholder}
        value={adminPanel[selectedTab.field]}
        onChange={(event) => onUpdateAdminPanel(selectedTab.field, event.target.value)}
      />
    </label>
  );
}

export default App;
