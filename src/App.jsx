import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './auth';
import { Footer, Header } from './components';
import Home from './pages/Home';
import Search from './pages/Search';
import Pro from './pages/Pro';
import Book from './pages/Book';
import Login from './pages/Login';
import Account from './pages/Account';
import ProSpace from './pages/ProSpace';
import { How, NotFound, Partner, Privacy } from './pages/Static';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ScrollTop />
      <Header />
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/coiffeurs" element={<Search />} />
          <Route path="/coiffeur/:id" element={<Pro />} />
          <Route path="/reserver/:id" element={<Book />} />
          <Route path="/connexion" element={<Login />} />
          <Route path="/mon-compte" element={<Account />} />
          <Route path="/espace-coiffeur" element={<ProSpace />} />
          <Route path="/comment-ca-marche" element={<How />} />
          <Route path="/devenir-partenaire" element={<Partner />} />
          <Route path="/confidentialite" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </AuthProvider>
  );
}
