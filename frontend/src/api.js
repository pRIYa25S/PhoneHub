import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000';

export const fetchProducts = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/products`);
  return response.data;
};

export const sendChatMessage = async (message, userId = 'guest') => {
  const response = await axios.post(`${API_BASE_URL}/api/chat`, {
    message,
    user_id: userId
  });
  return response.data;
};