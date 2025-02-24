import { faBuilding, faCalendar, faChevronUp, faInfoCircle, faMagic, faMapMarkedAlt, faUsers } from "@fortawesome/free-solid-svg-icons";
import React, {useState, useEffect} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import PackChart from "./PackChart";
import ParentSize from "@visx/responsive/lib/components/ParentSizeModern";
import { useRouter } from "next/router";
import { chartsDataService } from "../../../services/chartsData.service";
import LoadingSpinner from "../../LoadingSpinner/LoadingSpinner";

const STATS_PERCENTILE = 75;
const placesData = [
  {name: "Berlin",frequency: 5, recordings: [1, 2]},{name: "München",frequency: 10, recordings: [1, 2]},{name: "Frankfurt",frequency: 20, recordings: [1, 2]},
  {name: "Beijing",frequency: 7, recordings: [1, 2]},{name: "Paris",frequency: 20, recordings: [1, 2]}, {name: "Madrid",frequency: 14, recordings: [1, 2]},
]

const peopleData = [
  {name: "Angela Merkel",frequency: 5, recordings: [1, 2]},{name: "Donald Trump",frequency: 10, recordings: [1, 2]},{name: "Joe Biden",frequency: 20, recordings: [1, 3]},
  {name: "Joe Biden",frequency: 7, recordings: [1, 2]}
]

const orgData = [
  {name: "TU Berlin",frequency: 5, recordings: [1, 3]},{name: "Apple",frequency: 10, recordings: [1, 2]},{name: "IBM",frequency: 20, recordings: [1, 3]},
  {name: "Apple",frequency: 7, recordings: [1, 2]},{name: "Organisation",frequency: 20, recordings: [1, 3]}, {name: "Organisation",frequency: 14, recordings: [1, 3]},
  {name: "Organisation",frequency: 5, recordings: [1, 3]},{name: "Organisation",frequency: 10, recordings: [1, 2]},{name: "Organisation",frequency: 17, recordings: [1, 3]},
]

const datesData = [
  {name: "January",frequency: 5, recordings: [1, 3]},{name: "February",frequency: 10, recordings: [1, 3]},{name: "01.12.2021",frequency: 20, recordings: [1, 3]},
  {name: "12.Nov.96",frequency: 7, recordings: [1, 3]},{name: "March",frequency: 20, recordings: [1, 3]}, {name: "April 2018",frequency: 14, recordings: [1, 3]},
]

const StatisticsChartCard = () => {
    const router = useRouter();
    const { pid } = router.query;
    const [statistics, setStatitstics] = useState(null);
    const [loadingData, setLoadingData] = useState(true)
    const [selectedCategoryItem, setSelectedCategoryItem] = useState(null);
    const [showPlacesChart, setShowPlacesChart] = useState(true);
    const [showPeopleChart, setShowPeopleChart] = useState(false);
    const [showOrganisationsChart, setShowOrganisationsChart] = useState(false);
    const [showDatesChart, setShowDatesChart] = useState(false);
    const [peopleData, setPeopleData] = useState([]);
    const [datesData, setDatesData] = useState([]);
    const [placesData, setPlacesData] = useState([]);
    const [orgData, setOrgData] = useState([]);

 
    useEffect(() => {
      chartsDataService.gettProjectStats(pid, STATS_PERCENTILE).then((stats) => {
        setStatitstics(stats);
        setLoadingData(false);
        setPeopleData(getEntitiesForCateogry(stats, "PER"));
        setOrgData(getEntitiesForCateogry(stats, "ORG"));
        setPlacesData(getEntitiesForCateogry(stats, "LOC"));
        setDatesData(getEntitiesForCateogry(stats, "MISC"));
      })
    }, []);

    const hideAllCharts = () => {
      setShowPlacesChart(false);
      setShowPeopleChart(false);
      setShowOrganisationsChart(false);
      setShowDatesChart(false);
    }

    const getTimeFromSeconds = (secs) => {
      let hours   = Math.floor(secs / 3600);
      let minutes = Math.floor((secs - (hours * 3600)) / 60);
      let seconds = secs - (hours * 3600) - (minutes * 60);
  
      if (hours < 10) { hours   = "0"+ hours; }
      if (minutes < 10) {minutes = "0"+ minutes; }
      if (seconds < 10) {seconds = "0"+ seconds; }
      return ((hours + ':' + minutes + ':' + seconds).substring(0, 8));
    };
  
    const getEntitiesForCateogry = (statistics, catogory) => {
      for(let i = 0; i < statistics.labelled_entities.labelled_entities.length; i++) {
        let currentCategory = statistics.labelled_entities.labelled_entities[i];
        if (currentCategory.label == catogory) {
          return currentCategory.entities;
        }
      }
      return [];
    }

    return (
      <div className="custom-card vw-60">
          <div className="custom-card-header">
              <div className="custom-card-title">
                <span>Statistische Analyse</span>
                <div className={`d-inline-block custom-tooltip`}>
                  <button className="icon-button-transparent icon-orange mx-2">
                    <FontAwesomeIcon icon={faInfoCircle} />
                  </button>
                  {<span className="tooltiptext">In diesem Abschnitt kannst Du projektbezogene Informationen - Anzahl, durchschnittliche 
                  Länge und Wörteranzahl der Aufnahmen - finden. Zusätzlich wird ein Verfahren zur Erkennung von Eigennamen 
                  durchlaufen. Die erkannten Eigennamen werden in vier unterschiedliche Kategorien aufgeteilt - Ort, Person, 
                  Organisation und Divers - und in der Grafik dargestellt. Die Größe der Kreise ist hierbei proportional zur Häufigkeit des 
                  Auftretens des Eigennamens in dem Projekt. 
                  Klicke auf einen Eigennamen, um eine Liste der Aufnahmen zu sehen, in denen dieser vorkommt.</span>}
                </div>
              </div>
          </div>
          {loadingData && <LoadingSpinner text={"Grafik wird erstellt."}/>}
          {!loadingData && <div className="custom-card-body">
            <div className="d-flex flex-row justify-content-between py-1">
              <span>Anzahl der Aufnahmen:</span>
              <span className="text-end fw-bolder">{statistics.number_documents}</span>
            </div>
            <div className="d-flex flex-row justify-content-between py-1">
              <span>Durchschnittliche Länge der Aufnahmen:</span>
              <span className="text-end fw-bolder">{getTimeFromSeconds(Math.ceil(statistics.avg_duration))}</span>
            </div>
            <div className="d-flex flex-row justify-content-between py-1">
              <span>Durchschnittliche Wörteranzahl der Aufnahmen:</span>
              <span className="text-end fw-bolder">{Math.ceil(statistics.avg_len_text)} Wörter</span>
            </div>
            <div className="d-flex flex-column flex-lg-row justify-content-center pt-4 pb-1">
              <button disabled={placesData.length == 0} className={`${showPlacesChart ? "active": ""} custom-button custom-button-blue mx-1 my-1`} onClick={() => {hideAllCharts(); setShowPlacesChart(!showPlacesChart)}}>
                <FontAwesomeIcon icon={faMapMarkedAlt}/>
                <span className="px-1">Orte:</span>
                <span>{placesData.length}</span>
              </button>
              <button disabled={peopleData.length == 0} className={`${showPeopleChart ? "active": ""} custom-button custom-button-blue mx-1 my-1`} onClick={() => {hideAllCharts(); setShowPeopleChart(!showPeopleChart)}}>
                <FontAwesomeIcon icon={faUsers}/> 
                <span className="px-1">Personen:</span>
                <span>{peopleData.length}</span>
              </button>
              <button disabled={orgData.length == 0} className={`${showOrganisationsChart ? "active": ""} custom-button custom-button-blue mx-1 my-1`} onClick={() => {hideAllCharts(); setShowOrganisationsChart(!showOrganisationsChart)}}>
                <FontAwesomeIcon icon={faBuilding}/>
                <span className="px-1">Organisationen:</span>
                <span>{orgData.length}</span>
              </button>
              <button disabled={datesData.length == 0} className={`${showDatesChart ? "active": ""} custom-button custom-button-blue mx-1 my-1`} onClick={() => {hideAllCharts(); setShowDatesChart(!showDatesChart)}}>
                <FontAwesomeIcon icon={faMagic}/>
                <span className="px-1">Diverses:</span>
                <span className="fw-bold">{datesData.length}</span>
              </button>
            </div>
            {showPlacesChart && <div className="vh-70">
              <ParentSize>{({ width, height }) => <PackChart width={width} height={height} data={getEntitiesForCateogry(statistics, "LOC")} polygonSides={8} polygonRotation={0} colorScheme={1} setSelectedCategoryItem={setSelectedCategoryItem}/>}</ParentSize>
            </div>}
            {showPeopleChart && <div className="vh-70">
              <ParentSize>{({ width, height }) => <PackChart width={width} height={height} data={getEntitiesForCateogry(statistics, "PER")} polygonSides={4} polygonRotation={45} colorScheme={0} setSelectedCategoryItem={setSelectedCategoryItem}/>}</ParentSize>
            </div>}
            {showOrganisationsChart && <div className="vh-70">
              <ParentSize>{({ width, height }) => <PackChart width={width} height={height} data={getEntitiesForCateogry(statistics, "ORG")} polygonSides={6} polygonRotation={0} colorScheme={1} setSelectedCategoryItem={setSelectedCategoryItem}/>}</ParentSize>
            </div>}
            {showDatesChart && <div className="vh-70">
              <ParentSize>{({ width, height }) => <PackChart width={width} height={height} data={getEntitiesForCateogry(statistics, "MISC")} polygonSides={4} polygonRotation={0} colorScheme={0} setSelectedCategoryItem={setSelectedCategoryItem}/>}</ParentSize>
            </div>}
          </div>}
          {selectedCategoryItem && <div>
            <div className="pb-3 d-flex justify-content-between">
              <span>Wort <b>{selectedCategoryItem.text}</b> kommt in folgenden Aufnahmen vor</span>
              <button onClick={() => setSelectedWord({})} className="icon-button-transparent icon-blue mx-2">
                <FontAwesomeIcon icon={faChevronUp} />
              </button>
            </div>
            <div className="chart-recordings-list">{
              selectedCategoryItem.documents.map((doc, index) => (
                <div key={index} className="p-1 d-flex justify-content-between">
                  <span className="fw-bolder">{doc.title}</span>
                  <button onClick={() => router.push(`/project/${pid}/recording/${doc.id}`)} className="custom-button custom-button-sm custom-button-blue">Zur Aufnahme</button>
                </div>
              ))
            }</div>
        </div>}
      </div>
    )
};

export default StatisticsChartCard;
