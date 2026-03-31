import { localClient } from '@/api/localClient';

export const Role = {
  list: (orderBy, limit) => localClient.entities.Role.list(orderBy, limit),
  filter: (query, orderBy, limit) => localClient.entities.Role.filter(query, orderBy, limit),
  get: (id) => localClient.entities.Role.get(id),
  create: (data) => localClient.entities.Role.create(data),
  update: (id, data) => localClient.entities.Role.update(id, data),
  delete: (id) => localClient.entities.Role.delete(id),
};
