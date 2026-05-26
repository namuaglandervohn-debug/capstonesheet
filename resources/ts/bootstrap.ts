import axios from 'axios';

window.axios = axios;

axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

const token = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
if (token?.content) {
  axios.defaults.headers.common['X-CSRF-TOKEN'] = token.content;
}
