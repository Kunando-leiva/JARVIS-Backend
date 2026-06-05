import axios from 'axios';

export const githubService = {
  async getUserInfo(username) {
    try {
      const response = await axios.get(`https://api.github.com/users/${username}`);
      return {
        nombre: response.data.name,
        repos: response.data.public_repos,
        seguidores: response.data.followers,
        url: response.data.html_url
      };
    } catch (error) {
      return null;
    }
  },
  
  async getRepos(username) {
    try {
      const response = await axios.get(`https://api.github.com/users/${username}/repos?per_page=5`);
      return response.data.map(repo => ({
        nombre: repo.name,
        estrellas: repo.stargazers_count,
        lenguaje: repo.language,
        url: repo.html_url
      }));
    } catch (error) {
      return [];
    }
  },
  
  async getReadme(owner, repo) {
    try {
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/readme`, {
        headers: { 'Accept': 'application/vnd.github.v3.raw' }
      });
      return response.data.substring(0, 500);
    } catch (error) {
      return null;
    }
  }
};