import React, {useEffect, useState} from "react";
import RecordingOverviewBar from "./RecordingOverviewBar";
import {useRouter} from "next/router";
import {projectService} from "../../services";
import LoadingSpinnerOverlay from "../LoadingSpinner/LoadingSpinnerOverlay";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronLeft, faChevronRight, faPager, faPlus} from "@fortawesome/free-solid-svg-icons";

const ITEMS_PER_PAGE = 10;

const RecordingsOverview = ({onDeleteRecording}) => {
  const router = useRouter();
  const { pid } = router.query;
  const [pageIndex, setPageIndex] = useState(0);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [recordings, setRecordings] = useState([])
  const [pageRecordings, setPageRecordings] = useState([])

  useEffect(() => {
    let isMounted = true;
    setLoadingRecordings(true);
    projectService.getAllDocuments(pid).then((recs) => {
      if (isMounted) {
        recs.forEach((r) => {
          projectService.getTranscriptionJobStatus(pid, r.id, r.task_id).then(status => {
            r.status = status;
          });
        })
        setRecordings(recs)
        setPageRecordings(getPageData(recs, pageIndex));
        setLoadingRecordings(false);
      }
    });
    let interval = setInterval(function(){ 
      projectService.getAllDocuments(pid).then((recs) => {
        if (isMounted) {
          recs.forEach((r) => {
            projectService.getTranscriptionJobStatus(pid, r.id, r.task_id).then(status => {
              r.status = status;
            });
          })
          setPageRecordings(getPageData(recs, pageIndex));
        }
      });
    }, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval)
    };
  }, []); 

  function recordingDeleted(){
    projectService.getAllDocuments(pid).then((recs) => {
        recs.forEach((r) => {
          projectService.getTranscriptionJobStatus(pid, r.id, r.task_id).then(status => {
            r.status = status;
          });
        })
        setRecordings(recs)
        setPageRecordings(getPageData(recs, pageIndex));
    });
  }

  return (
    <React.Fragment>
      {loadingRecordings && <LoadingSpinnerOverlay text={"Audiodateien werden geladen!"}/> }
      <button className="border-button border-button-blue full-width" onClick={() =>  router.push({pathname: `/project/${pid}/update`, query: {step: 2}})}><FontAwesomeIcon icon={faPlus} /><span className="px-3">Aufnahme hinzufügen</span></button>
      {pageRecordings.length > 0 && pageRecordings.map(recording => (
        <RecordingOverviewBar onRecordingDeleted={recordingDeleted} recording={recording} key={recording.id}/>
      ))}
      {pageRecordings.length == 0 &&
      <div className="d-flex justify-content-center align-items-center vh-80 flex-column">
        <h5 className="text-center">Du hast kein Aufnahmen hochgeladet!</h5>
      </div>
      }
      {recordings && <div
        className={`d-flex flex-row pt-4 ${!showPrevArrow(pageIndex) ? 'justify-content-end' : 'justify-content-between'}`}>
        {showPrevArrow(pageIndex) &&
        <button onClick={() => setPageIndex(pageIndex - 1)} className="icon-button-round mx-2">
          <FontAwesomeIcon icon={faChevronLeft}/></button>}
        {showNextArrow(pageIndex, recordings) &&
        <button onClick={() => setPageIndex(pageIndex + 1)} className="icon-button-round mx-2">
          <FontAwesomeIcon icon={faChevronRight}/></button>}
      </div>
      }
    </React.Fragment>
  )
};

const getPageData = (projects, page) => {
  if(projects)  return projects.slice(page*ITEMS_PER_PAGE, page*ITEMS_PER_PAGE+ITEMS_PER_PAGE);
};

const showNextArrow = (currentPageIndex, filteredProjects) => {
  return currentPageIndex < (filteredProjects.length/ITEMS_PER_PAGE) - 1;
};

const showPrevArrow = (currentPageIndex) => {
  return currentPageIndex > 0;
};



export default RecordingsOverview;
