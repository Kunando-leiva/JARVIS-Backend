import axios from 'axios';

const OPENWEATHER_API_KEY = '6e54b5d4167b420870fe929910';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

export const weatherService = {
  async getCurrentWeather(city) {
    try {
      const url = `${BASE_URL}/weather?q=${encodeURIComponent(city)}&units=metric&appid=${OPENWEATHER_API_KEY}&lang=es`;
      const response = await axios.get(url);
      return {
        success: true,
        city: response.data.name,
        temperature: Math.round(response.data.main.temp),
        description: response.data.weather[0].description
      };
    } catch (error) {
      return { success: false, error: 'No se pudo obtener el clima' };
    }
  }
};

export default weatherService;