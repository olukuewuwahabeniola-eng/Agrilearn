import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import InfoCards from "../components/InfoCards";
import Features from "../components/Features";
import Levels from "../components/Levels";
import FAQ from "../components/FAQ";
import Contact from "../components/Contact";
import FooterCTA from "../components/FooterCTA";
import Footer from "../components/Footer";
import useReveal from "../hooks/useReveal";

function Home() {
  useReveal();

  return (
    <div className="app">
      <Navbar />
      <main>
        <Hero />
        <InfoCards />
        <Features />
        <Levels />
        <FAQ />
        <Contact />
        <FooterCTA />
      </main>
      <Footer />
    </div>
  );
}

export default Home;
