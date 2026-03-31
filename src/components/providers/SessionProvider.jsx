import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/entities/User';
import { Role } from '@/entities/Role';
import { Location } from '@/entities/Location';

const SessionContext = createContext(null);

const PREVIEW_KEY = 'equist_preview_role_id';

export function SessionProvider({ children }) {
  const [state, setState] = useState({
    currentUser: null,
    userRole: null,
    userLocation: null,
    permissions: [],
    allRoles: [],
    isRealAdmin: false,
    isLoading: true,
    error: null
  });

  const [previewRoleId, setPreviewRoleIdState] = useState(() => sessionStorage.getItem(PREVIEW_KEY) || null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const user = await User.me();
        if (cancelled) return;

        const [roles, locations] = await Promise.all([
          Role.list().catch(() => []),
          Location.list().catch(() => [])
        ]);
        if (cancelled) return;

        let userRole = null;
        let permissions = [];
        let userLocation = null;
        const isRealAdmin = user.role === 'admin';

        if (isRealAdmin) {
          const allPerms = roles.flatMap(r => r.permissions || []);
          permissions = [...new Set(allPerms)];
          userRole = { name: 'Administrador', permissions };
        } else if (user.role_id && user.role_id !== '' && user.role_id !== 'null' && user.role_id !== 'undefined') {
          const role = roles.find(r => r.id === user.role_id || r.id?.trim() === user.role_id?.trim());
          if (role) {
            userRole = role;
            permissions = Array.isArray(role.permissions) ? role.permissions : [];
          }
        }

        if (user.location_id) {
          userLocation = locations.find(l => l.id === user.location_id) || null;
        }

        console.log("🔐 SessionProvider:", user.email, "| Rol:", userRole?.name, "| Permisos:", permissions.length);

        if (cancelled) return;
        setState({
          currentUser: user,
          userRole,
          userLocation,
          permissions,
          allRoles: roles,
          isRealAdmin,
          isLoading: false,
          error: null
        });

      } catch (error) {
        if (cancelled) return;
        setState(s => ({ ...s, currentUser: null, userRole: null, userLocation: null, permissions: [], isLoading: false, error: error.message }));
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const setPreviewRole = (roleId) => {
    if (!roleId) {
      sessionStorage.removeItem(PREVIEW_KEY);
      setPreviewRoleIdState(null);
    } else {
      sessionStorage.setItem(PREVIEW_KEY, roleId);
      setPreviewRoleIdState(roleId);
    }
  };

  const exitPreview = () => setPreviewRole(null);

  // Build effective context — override permissions/userRole when previewing
  let effective = { ...state };
  if (previewRoleId && state.isRealAdmin && !state.isLoading) {
    const role = state.allRoles.find(r => r.id === previewRoleId);
    if (role) {
      effective.userRole = role;
      effective.permissions = Array.isArray(role.permissions) ? role.permissions : [];
    }
  }

  const contextValue = {
    ...effective,
    previewRoleId,
    setPreviewRole,
    exitPreview,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used within a SessionProvider');
  return context;
};
