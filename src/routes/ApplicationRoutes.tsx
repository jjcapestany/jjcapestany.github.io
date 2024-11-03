import {createBrowserRouter} from "react-router-dom";
import LandingPage from "../components/LandingPage.tsx";
import AboutMe from "../components/AboutMe.tsx";

export const router = createBrowserRouter([
    {
        path: "/",
        element:<LandingPage/>,
    },
    {
        path: '/about-me',
        element:<AboutMe/>,
    }
]);