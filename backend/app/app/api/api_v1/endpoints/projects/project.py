import logging
from typing import List, Any, Union
import json

from sqlalchemy.orm import Session

from fastapi import File, UploadFile, Depends, HTTPException, Form
from fastapi.responses import FileResponse

from app import crud, models, schemas, file_storage
from app.api import deps
from app.core.config import settings
from app.schemas import AnnotTopicIn, AnnotTopicOut, AnnotPin, FileUpload
from app.models.language import language_to_tokenizer, Language

from .router import router
from .helper import transform_to_annots, transform_annot_in, check_doc_for_upload

from datetime import timedelta

LOG = logging.getLogger(__name__)


@router.post("/", response_model=schemas.Project)
def create_project(
    *,
    project_in: schemas.ProjectCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> schemas.Project:
    try:
        project = crud.project.create(db, obj_in=project_in)
    # Handle creation of unique project names
    except Exception as e:
        raise HTTPException(
            status_code=409,
            detail=str(e),
        )

    return project

@router.get("/", response_model=List[schemas.Project])
def read_projects(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> List[schemas.Project]:
    """
    Retrieve projects.
    """
    projects = crud.project.get_multi(db, skip=skip, limit=limit)
    return projects

@router.get("/{project_id}", response_model=schemas.Project)
def read_project_by_id(
    project_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Get a specific project by id.
    """
    project = crud.project.get(db, id=project_id)
    return project

@router.put("/{project_id}", response_model=schemas.Project)
def update_project(
    *,
    db: Session = Depends(deps.get_db),
    project_id: int,
    project_in: schemas.ProjectUpdate,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> schemas.Project:
    """
    Update a project.
    """
    project = crud.project.get(db, id=project_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail="The project with this id does not exist in the system",
        )
        
    project = crud.project.update(db, db_obj=project, obj_in=project_in)
    return project


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Delete a specific project by id.
    """
    try:
        crud.project.remove(db, id=project_id)
    except Exception as e:
        raise HTTPException(
            status_code=409,
            detail=f"{e}"
        )


@router.post("/{project_id}/docs/", response_model=schemas.Document)
async def create_document(
    *,
    project_id: int,
    document_in: schemas.DocumentCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> schemas.Document:
    
    project = crud.project.get(db, id=project_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail="The project with this id does not exist in the system",
        )

    if not document_in.fk_project:
        document_in.fk_project = project_id
    document = crud.document.create(db, obj_in=document_in)

    return document


@router.get("/{project_id}/docs/", response_model=List[schemas.Document])
def read_documents(
    project_id: int,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> List[schemas.Document]:
    """
    Retrieve documents.
    """
    documents = crud.document.get_multi_by_p_id(db, skip=skip, limit=limit, fk_project=project_id)
    return documents


@router.post("/{project_id}/docs/files")
async def upload_files(
    project_id: int,
    doc_ids_with_name: str = Form(...),
    db: Session = Depends(deps.get_db),
    files: List[UploadFile] = File(...),
    current_user: models.User = Depends(deps.get_current_active_superuser),
):
    """
    Upload multiple files in a batch. The doc_ids_with_name parameters is needed as a string but in a json like format.
    Args: doc_ids_with_name ... mapping for document_id and filename in this format [{\"document_id\": 1, \"filename\": \"test.mp3\"}]
    """

    try: 
        # Parse the string to json
        doc_ids_with_name = json.loads(doc_ids_with_name)
        
        doc_ids_wn = []
        for doc in doc_ids_with_name:
            doc_ids_wn.append(FileUpload(**doc))

    except Exception as e:
        LOG.info(e)
        raise HTTPException(
            status_code=422,
            detail="Please provide the data as a string but in a json like format: [{\"document_id\": 1, \"filename\": \"test.mp3\"}]"
        )
    
    for doc in doc_ids_wn:
        document_id = doc.document_id

        if not isinstance(document_id, int):
            document_id = int(document_id)
            
        filename = doc.filename

         
        # Get the file we want to upload via its filename
        tmp_files = [file for file in files if file.filename==filename]
        if len(tmp_files) > 1:
            raise HTTPException(
                status_code=409,
                detail="There are duplicated filenames! Please review the provided document_id to filename mapping.",
            )
        file = tmp_files[0]


        document, suffix = check_doc_for_upload(
            db=db,
            document_id=document_id,
            project_id=project_id,
            file=file)

        await crud.document.create_audio_file(db, document, file, suffix)


@router.get("/{project_id}/docs/{document_id}", response_model=schemas.Document)
def read_document_by_id(
    project_id: int,
    document_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Get a specific document by id.
    """

    document = crud.document.get_by_p_id(db, id=document_id, fk_project=project_id)
    if not document:
        raise HTTPException(
            status_code=404,
            detail="The document with this id and project id does not exist in the system",
        )
    return document


@router.put("/{project_id}/docs/{document_id}", response_model=schemas.Document)
def update_document(
    *,
    project_id: int,
    db: Session = Depends(deps.get_db),
    document_id: int,
    document_in: schemas.DocumentUpdate,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> schemas.Document:
    """
    Update a document.
    """
    document = crud.document.get_by_p_id(db, id=document_id, fk_project=project_id)
    if not document:
        raise HTTPException(
            status_code=404,
            detail="The document with this id and project id does not exist in the system",
        )
    document = crud.document.update(db, db_obj=document, obj_in=document_in)
    return document


@router.delete("/{project_id}/docs/{document_id}")
def delete_document(
    project_id: int,
    document_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Get a specific document by id.
    """
    try:
        crud.document.remove_by_p_id(db, id=document_id, fk_project=project_id)
    except Exception as e:
        raise HTTPException(
            status_code=409,
            detail=f"{e}"
        )

@router.get("/{project_id}/docs/{document_id}/fulltext")
def get_fulltext(
    project_id: int,
    document_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> str:
    """
    Get the fulltext of  specific document by id.
    """

    document = crud.document.get_by_p_id(db, id=document_id, fk_project=project_id)
    if not document:
        raise HTTPException(
            status_code=404,
            detail="The document with this id and project id does not exist in the system",
        )

    if not document.fulltext:
        raise HTTPException(
            status_code=409,
            detail="There is no transcription for this document!",
        )

    return document.fulltext

@router.get("/{project_id}/docs/{document_id}/words", response_model=schemas.Words)
def get_words(
    project_id: int,
    document_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> schemas.Words:
    """
    Get the words of specific document by id.
    """

    document = crud.document.get_by_p_id(db, id=document_id, fk_project=project_id)
    if not document:
        raise HTTPException(
            status_code=404,
            detail="The document with this id and project id does not exist in the system",
        )

    if not document.words:
        raise HTTPException(
            status_code=409,
            detail="There is no transcription for this document!",
        )

    list_words = [word for word in document.words if word.current_order is not None]

    return schemas.Words(words=list_words)


@router.post("/{project_id}/docs/{document_id}/words")
def edit_words(
    project_id: int,
    document_id: int,
    words_in: schemas.EditedWordsIn,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser)
) -> Any:
    """
    Add, update and delete words. As the Backend is working with versioning you cannot really delete or change a word.
    There is always a word created that has the same initial_order as the corresponding existing word.
    - Args: The project id, the document id and the words to edit with a timeframe.
    - Returns: A list of words with all its attributes.
    """
    document = crud.document.get_by_p_id(db, id=document_id, fk_project=project_id)
    if not document:
        raise HTTPException(
            status_code=404,
            detail="The document with this id and project id does not exist in the system",
        )
    tokenizer = language_to_tokenizer[document.language]

    # set words_in to no string at all to ensure that everything is deleted
    if not (words_in.text and words_in.text.strip()):
        # check if string is "" or " " or "   " or ....
        words_in.text = ""

    # split incoming text into a list of words and punctuation
    tokens_in = [token for token in tokenizer(words_in.text)]
    start_time = timedelta(seconds=words_in.start_time)
    end_time = timedelta(seconds=words_in.end_time)

    document = crud.document.edit_words(db, document, tokens_in, start_time, end_time)

    list_words = [word for word in document.words if word.current_order is not None]
    # Get words after being commited to database
    document = crud.document.update_fulltext(db, document, list_words)

    return schemas.Words(words=list_words)



@router.get("/{project_id}/docs/{document_id}/file")
async def download_file(
    project_id: int,
    document_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
):
    document = crud.document.get_by_p_id(db, id=document_id, fk_project=project_id)
    if not document:
        raise HTTPException(
            status_code=404,
            detail="The document with this id does not exist in the system",
        )

    if not document.audio_file_key:
        raise HTTPException(
            status_code=404,
            detail="The document with this id has no file",
        )

    return file_storage.create_presigned_url(document.audio_file_key)


@router.post("/{project_id}/docs/{document_id}/file")
async def upload_file(
    project_id: int,
    document_id: int,
    db: Session = Depends(deps.get_db),
    file: UploadFile = File(...),
    current_user: models.User = Depends(deps.get_current_active_superuser),
):
    document, suffix = check_doc_for_upload(
            db=db,
            document_id=document_id,
            project_id=project_id,
            file=file)

    await crud.document.create_audio_file(db, document, file, suffix)



@router.post("/{project_id}/docs/{document_id}/annots")
def create_annotation(
    *,
    project_id: int,
    document_id: int,
    annot_in: schemas.AnnotTopicIn,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Union[AnnotTopicOut,AnnotPin]:
    """
    Takes an annotation in the data structure of a topic by wavesurfer.js and stores it.
    - Args: Project ID, document ID and the annotation - can be either Topic or Pin.
    - Returns: The created single Annotation that is either Pin or Topic.
    """
    document = crud.document.get_by_p_id(db, id=document_id, fk_project=project_id)
    if not document:
        raise HTTPException(
            status_code=404,
            detail="The document with this id does not exist in the system",
        )

    if annot_in.start == annot_in.end:
        type = "Pin"
    else:
        type = "Topic"

    try:
        annot = crud.annot.create(db, obj_in=annot_in, type=type, doc_id=document_id)
    except Exception as e:
        raise HTTPException(
            status_code=409,
            detail=f"{e}"
        )

    return transform_to_annots([annot])[0]


@router.put("/{project_id}/docs/{document_id}/annots/{annot_id}")
def update_annotation(
    *,
    project_id: int,
    document_id: int,
    annot_id: int,
    db: Session = Depends(deps.get_db),
    annot_in: schemas.AnnotUpdatePinTop,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Union[AnnotTopicOut,AnnotPin]:
    """
    Updates an annotation via its ID and the new annotationn data.
    - Args: Project ID, document ID, annotation ID and the annotation - can be either Topic or Pin.
    - Returns: The updated single Annotation that is either Pin or Topic.
    """
    annot = crud.annot.get_by_doc_id(db, id=annot_id, fk_document=document_id)
    if not annot:
        raise HTTPException(
            status_code=404,
            detail="The annotation with this id and document id does not exist in the system",
        )

    annot_in = transform_annot_in(annot_in)

    annot = crud.annot.update(db, db_obj=annot, obj_in=annot_in)

    return transform_to_annots([annot])[0]


@router.delete("/{project_id}/docs/{document_id}/annots/{annot_id}")
def delete_annotation(
    project_id: int,
    document_id: int,
    annot_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Delete a specific annotation by id.
    """
    try:
        crud.annot.rem_by_doc_id(db, id=annot_id, fk_document=document_id)
    except Exception as e:
        raise HTTPException(
            status_code=409,
            detail=f"{e}"
        )


@router.get("/{project_id}/docs/{document_id}/annots/pins")
def get_pins(
    project_id: int,
    document_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> List[AnnotPin]:
    """
    Get all Pins of a document.
    - Args: Project ID and the document ID
    - Returns: The list of Annotations for this document that are Pins.
    """
    annots = crud.annot.get_by_d_type(db, fk_document=document_id, type="Pin")

    if not annots:
        return []

    return transform_to_annots(annots)


@router.get("/{project_id}/docs/{document_id}/annots/topics")
def get_topics(
    project_id: int,
    document_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> List[AnnotTopicOut]:
    """
    Get all Topics of a document.
    - Args: Project ID and the document ID
    - Returns: The list of Annotations for this document that are Topics.
    """

    annots = crud.annot.get_by_d_type(db, fk_document=document_id, type="Topic")

    if not annots:
        return []

    return transform_to_annots(annots)
    
