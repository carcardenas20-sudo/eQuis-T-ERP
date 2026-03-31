import { localClient } from '@/api/localClient';

export const Location = {
  list: (orderBy, limit) => localClient.entities.Location.list(orderBy, limit),
  filter: (query, orderBy, limit) => localClient.entities.Location.filter(query, orderBy, limit),
  get: (id) => localClient.entities.Location.get(id),
  create: (data) => localClient.entities.Location.create(data),
  update: (id, data) => localClient.entities.Location.update(id, data),
  delete: (id) => localClient.entities.Location.delete(id),
};
