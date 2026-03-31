import { localClient, setToken, getToken } from '@/api/localClient';

export const User = {
  me: () => localClient.auth.me(),
  list: (orderBy, limit) => localClient.entities.User.list(orderBy, limit),
  filter: (query, orderBy, limit) => localClient.entities.User.filter(query, orderBy, limit),
  get: (id) => localClient.entities.User.get(id),
  create: (data) => localClient.entities.User.create(data),
  update: (id, data) => localClient.entities.User.update(id, data),
  delete: (id) => localClient.entities.User.delete(id),
  logout: () => {
    setToken(null);
    window.location.reload();
  },
};
