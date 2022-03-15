import { useState } from "react";
import { Provider } from "react-redux";
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import './App.scss';
import store from "./state/store";
import { Home } from "./pages/Home";
import { ImportPage } from "./pages/Import";

function App() {
  const [id, setStateID] = useState<string>('');
  const setID = (s: string): void => {
    setStateID(s)
  };

  return (
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home setID={setID} />} />
          <Route path="/import" element={<ImportPage id={id} />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}

export default App;
